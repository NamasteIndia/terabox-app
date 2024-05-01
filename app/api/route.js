import { NextResponse } from "next/server";
import axios from "axios";

import CryptoJS from "crypto-js";

function getFormattedSize(sizeBytes) {
  let size, unit;

  if (sizeBytes >= 1024 * 1024) {
    size = sizeBytes / (1024 * 1024);
    unit = "MB";
  } else if (sizeBytes >= 1024) {
    size = sizeBytes / 1024;
    unit = "KB";
  } else {
    size = sizeBytes;
    unit = "bytes";
  }

  return `${size.toFixed(2)} ${unit}`;
}

function findBetween(str, start, end) {
  const startIndex = str.indexOf(start) + start.length;
  const endIndex = str.indexOf(end, startIndex);
  return str.substring(startIndex, endIndex);
}

const headers = {
  Accept:
    "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7",
  "Accept-Language": "en-IN,en-GB;q=0.9,en-US;q=0.8,en;q=0.7,hi;q=0.6",
  Connection: "keep-alive",
  Cookie:
    "csrfToken=F1zg17QOH1zvKOkQngl687XL; browserid=uHOasP62qwBsulieIbDDErap_D_6caRVoBWpykPfyXveXi0CTt-ZBOoHLhM=; lang=en; __bid_n=18f33d7c3c3f6f31c34207; __stripe_mid=6e31f7f5-f6b0-4115-9369-5cf116a6bf0d14c542; __stripe_sid=b9081afd-9628-430f-adb3-961239d790899e6e61; ndus=YdiBz8HteHui_wwY3kKDqyTm3PucSlkwKbcWtYov; ndut_fmt=E363F79A6329DCA4E6FC6423FFCE45522173A377F225376C8085C42BBF8B7FA0",
  DNT: "1",
  Host: "www.4funbox.com",
  "Sec-Fetch-Dest": "document",
  "Sec-Fetch-Mode": "navigate",
  "Sec-Fetch-Site": "none",
  "Sec-Fetch-User": "?1",
  "Upgrade-Insecure-Requests": "1",
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/113.0.0.0 Safari/537.36",
  "sec-ch-ua":
    '"Google Chrome";v="113", "Chromium";v="113", "Not-A.Brand";v="24"',
  "sec-ch-ua-mobile": "?0",
  "sec-ch-ua-platform": '"Windows"',
};

export async function GET(req, res) {
  const { searchParams: params } = new URL(req.url);
  if (!params.has("data")) {
    return NextResponse.json({ error: "Missing data" }, { status: 400 });
  }
  const encryptedData = params.get("data");
  if (!encryptedData) {
    return NextResponse.json({ error: "Missing data" }, { status: 400 });
  }
  const secretKey = "1a2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d";
  let url;
  try {
    const decryptedBytes = CryptoJS.AES.decrypt(encryptedData, secretKey);
    const decryptedData = decryptedBytes.toString(CryptoJS.enc.Utf8);
    const { token: decryptedToken, expiresAt } = JSON.parse(decryptedData);
    url = decryptedToken;
    console.log(url, expiresAt);
    if (Date.now() > expiresAt) {
      return NextResponse.json({ error: "Expired token" }, { status: 401 });
    }
  } catch (error) {
    console.error("Decryption error:", error);
    return NextResponse.json(
      { error: "Invalid encrypted data" },
      { status: 400 }
    );
  }
  try {
    const req = await axios.get(url, { headers, withCredentials: true });
    const responseData = req.data;
    const jsToken = findBetween(responseData, "fn%28%22", "%22%29");
    const logid = findBetween(responseData, "dp-logid=", "&");
    if (!jsToken || !logid) {
      return NextResponse.json({ error: "Invalid response" }, { status: 400 });
    }
    const { searchParams: requestUrl, href } = new URL(
      req.request.res.responseUrl
    );
    if (!requestUrl.has("surl")) {
      return NextResponse.json({ error: "Missing data" }, { status: 400 });
    }
    const surl = requestUrl.get("surl");

    const params = {
      app_id: "250528",
      web: "1",
      channel: "dubox",
      clienttype: "0",
      jsToken: jsToken,
      dplogid: logid,
      page: "1",
      num: "20",
      order: "time",
      desc: "1",
      site_referer: href,
      shorturl: surl,
      root: "1",
    };

    const req2 = await axios.get("https://www.4funbox.com/share/list", {
      params,
      headers,
      withCredentials: true,
    });
    const responseData2 = req2.data;
    if (!"list" in responseData2) {
      return NextResponse.json({ error: "Invalid response" }, { status: 400 });
    }
    return NextResponse.json(responseData2?.list[0], { status: 200 });
  } catch (error) {
    return NextResponse.json({ error: "Unknown Error" }, { status: 400 });
  }
}
