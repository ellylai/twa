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
from playwright.sync_api import sync_playwright

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
    # server time
    try:
        today = datetime.now()
        day_key = today.strftime("%m-%d")
        formatted_date = today.strftime("%B %d")
        print(f"--- [DEBUG]: Using server-generated day_key: {day_key} ---")
    except Exception as e:
        print(f"Error getting server date: {e}")
        raise

    try:
        response = (
            supabase.from_("daily_passages")
            .select("content")
            .eq("day_key", day_key)
            .single()
            .execute()
        )
        if response.data:
            print(f"--- DEBUG: Found cached data for {day_key} ---")
            return day_key, formatted_date, response.data["content"]
    except Exception as e:
        print(f"--- DEBUG: No cache for {day_key}. Proceeding to scrape. ---")
        server_day_key = day_key
        pass

    # --- Part A: Scrape SJCAC ---
    try:
        with sync_playwright() as p:
            browser = p.chromium.launch(headless=True)
            page = browser.new_page()

            page.goto("https://www.sjcac.org/twa/", wait_until="networkidle")

            html = page.content()
            # with open("dump.html", "w", encoding="utf-8") as f:
            #     f.write(html)
            browser.close()

        sjcac_soup = BeautifulSoup(html, "html.parser")

        date_tag = sjcac_soup.find("div", {"id": "comp-ltdcf3gt2"})
        if not date_tag:
            raise Exception("Could not find date component (comp-ltdcf3gt2)")

        sjcac_date_str = date_tag.get_text(strip=True)

        link_tag_container = sjcac_soup.find("div", {"id": "comp-mhl12muh2"})
        if not link_tag_container:
            raise Exception("Could not find link component (comp-mhl12muh2)")

        link_tag = link_tag_container.find("a")
        if not link_tag or not link_tag.has_attr("href"):
            raise Exception("Could not find <a> tag with href in link component")

        bible_gateway_url = link_tag["href"]
        if "biblegateway.com" not in bible_gateway_url:
            raise Exception("Found link is not for Bible Gateway")

        print(f"--- DEBUG: Found Date: {sjcac_date_str} ---")
        print(f"--- DEBUG: Found URL: {bible_gateway_url} ---")

        # --- 3. Convert date to our dayKey (using the "no year" logic) ---
        date_part = sjcac_date_str.split(", ")[1]

        dummy_year_str = " 2000"
        date_obj = datetime.strptime(date_part + dummy_year_str, "%b %d %Y")

        day_key = date_obj.strftime("%m-%d")
        formatted_date = date_obj.strftime("%B %d")
        if day_key != server_day_key:
            raise Exception(f"Server Day {server_day_key} != Scraped Day {day_key}")

    except Exception as e:
        print(f"SJCAC scrape error: {e}")
        raise

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
                if h3_tag.string in passage_headers[i]:
                    h3_tag.decompose()
            for sup in container.find_all("sup", class_=["crossreference", "footnote"]):
                sup.decompose()
            for h4 in container.find_all("h4"):
                print(h4)

            for a_tag in container.find_all("a", class_="full-chap-link"):
                a_tag.decompose()
            for div in container.find_all("div", class_="passage-other-trans"):
                div.decompose()
            final_html_parts.append(str(container))

        passage_html = "".join(final_html_parts)

        # --- Part D: Save to Supabase (using correct key) ---
        try:
            print(f"--- DEBUG: Saving new content to cache for {day_key} ---")
            supabase.from_("daily_passages").insert(
                {
                    "day_key": day_key,
                    "content": passage_html,
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
