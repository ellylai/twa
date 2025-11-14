# In /api/get-passage.py

import os
import requests
import json
from flask import Flask, request, jsonify, Response
from supabase import create_client, Client
from bs4 import BeautifulSoup
from dotenv import load_dotenv
from datetime import datetime
import re

load_dotenv(dotenv_path=".env.local")

app = Flask(__name__)

# --- Supabase Setup ---
url = os.environ.get("VITE_SUPABASE_URL")
key = os.environ.get("VITE_SUPABASE_ANON_KEY")
supabase: Client = create_client(url, key)


def scrape_and_parse_passage():
    """
    Scrapes SJCAC, determines the correct date and dayKey,
    then scrapes and cleans the Bible Gateway HTML.

    Returns:
        tuple: (day_key, formatted_date, passage_html)
    """

    # --- Part A: Scrape SJCAC ---
    try:
        sjcac_url = "https://www.sjcac.org/twa/"
        sjcac_response = requests.get(sjcac_url, timeout=10)
        sjcac_soup = BeautifulSoup(sjcac_response.text, "html.parser")

        script_tag = sjcac_soup.find("script", id="wix-warmup-data")
        if not script_tag or not script_tag.string:
            raise Exception("Could not find wix-warmup-data script tag")

        json_data = json.loads(script_tag.string)
        props = json_data.get("platform", {}).get("ssrPropsUpdates", [{}])[0]

        # --- Find date, passages, and URL in ONE loop ---
        sjcac_date_str = None
        passage_references_html = None  # This is the variable that was missing
        bible_gateway_url = None

        for key, value in props.items():
            if not isinstance(value, dict):
                continue

            # A. Find the Date
            if "html" in value and "wixui-rich-text__text" in value["html"]:
                match = re.search(
                    r'<span class="wixui-rich-text__text">(.*?)<\/span>', value["html"]
                )
                if match:
                    date_candidate = match.group(1)
                    if (
                        "Mon," in date_candidate
                        or "Tue," in date_candidate
                        or "Wed," in date_candidate
                        or "Thu," in date_candidate
                        or "Fri," in date_candidate
                        or "Sat," in date_candidate
                        or "Sun," in date_candidate
                    ):
                        sjcac_date_str = date_candidate  # e.g., "Wed, Nov 12"

            # B. Find the Passage List (from your old JSON)
            if "html" in value and "<br>" in value["html"]:
                passage_soup = BeautifulSoup(value["html"], "html.parser")
                span = passage_soup.find("span", class_="wixui-rich-text__text")
                if span:
                    passage_references_html = str(span.decode_contents())

            # C. Find the Bible Gateway URL
            if "link" in value and "href" in value.get("link", {}):
                href = value["link"]["href"]
                if "biblegateway.com" in href and "version=NIV" in href:
                    bible_gateway_url = href.replace(r"\/", "/")

        if not sjcac_date_str or not bible_gateway_url or not passage_references_html:
            raise Exception(
                f"Missing SJCAC data: Date({sjcac_date_str}), URL({bible_gateway_url}), Passages({passage_references_html})"
            )

        # --- Convert date to our dayKey (using the "no year" logic) ---
        date_part = sjcac_date_str.split(", ")[1]
        if "," in date_part:
            date_part = date_part.split(",")[0]  # "Nov 12"

        dummy_year_str = " 2000"
        date_obj = datetime.strptime(date_part + dummy_year_str, "%b %d %Y")

        day_key = date_obj.strftime("%m-%d")
        formatted_date = date_obj.strftime("%B %d")  # "November 12"

    except Exception as e:
        print(f"SJCAC scrape error: {e}")
        raise

    # --- Part B: Check Cache (using our NEW day_key) ---
    try:
        response = (
            supabase.from_("daily_passages")
            .select("content")
            .eq("day_key", day_key)
            .single()
            .execute()
        )
        if response.data:
            return day_key, formatted_date, response.data["content"]
    except Exception as e:
        pass  # Not found in cache

    # --- Part C: Scrape Bible Gateway (if not in cache) ---
    try:
        bg_response = requests.get(bible_gateway_url)
        bg_soup = BeautifulSoup(bg_response.text, "html.parser")

        meta_tag = bg_soup.find("meta", property="og:title")
        content_string = meta_tag["content"]
        content_string = content_string.replace("Bible Gateway passage: ", "")
        version_separator = content_string.rfind(" - ")
        if version_separator != -1:
            content_string = content_string[:version_separator]
        passage_headers = content_string.split(", ")

        for footnote_div in bg_soup.find_all("div", class_=["footnotes", "crossrefs"]):
            footnote_div.decompose()

        passage_containers = bg_soup.find_all("div", class_="passage-content")
        if not passage_containers:
            raise Exception('Could not parse any "passage-content" containers')

        final_html_parts = []

        for i, container in enumerate(passage_containers):
            if i < len(passage_headers):
                new_header = bg_soup.new_tag("h3")
                new_header.string = passage_headers[i]
                final_html_parts.append(str(new_header))

            for h3_tag in container.find_all("h3"):
                h3_tag.name = "h4"
            for sup in container.find_all("sup", class_=["crossreference", "footnote"]):
                sup.decompose()
            for h4 in container.find_all("h4"):
                h4.decompose()
            for a_tag in container.find_all("a", class_="full-chap-link"):
                a_tag.decompose()
            for div in container.find_all("div", class_="passage-other-trans"):
                div.decompose()
            final_html_parts.append(str(container))

        passage_html = "".join(final_html_parts)

        # --- Part D: Save to Supabase (using correct key) ---
        try:
            supabase.from_("daily_passages").insert(
                {
                    "day_key": day_key,
                    "content": passage_html,
                    # Use the clean string from the meta tag
                    "passage_references": content_string,
                    "created_at": datetime.now().isoformat(),
                }
            ).execute()
        except Exception as db_error:
            print(f"DB Save Error: {db_error}")

        return day_key, formatted_date, passage_html

    except Exception as e:
        print(f"Bible Gateway scrape error: {e}")
        raise


# --- 2. MAIN API ENDPOINT (NOW MUCH SIMPLER) ---
@app.route("/api/get-passage", methods=["GET"])
def get_passage():
    try:
        # Scrape and get all data
        day_key, formatted_date, passage_html = scrape_and_parse_passage()

        # Return a JSON object to the frontend
        return jsonify(
            {
                "dayKey": day_key,
                "formattedDate": formatted_date,
                "passageHtml": passage_html,
            }
        )

    except Exception as e:
        print(f"TOP LEVEL ERROR: {e}")
        return jsonify({"error": str(e)}), 500


if __name__ == "__main__":
    app.run(debug=True, port=3001)
