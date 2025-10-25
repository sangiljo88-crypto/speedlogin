// Netlify Function: sheets-proxy.js
// Google Apps Script로 프록시 요청을 전달합니다.

const GOOGLE_SCRIPT_URL = "https://script.google.com/macros/s/AKfycby27fD-10Q9czI1Eg6uWEmb6ApWkAhNYT7QFIELdelDgwa_klkmHd5RtgYrhvrYJh8_/exec";

exports.handler = async (event, context) => {
  // CORS 헤더 설정
  const headers = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Content-Type": "application/json"
  };

  // OPTIONS 요청 처리 (CORS preflight)
  if (event.httpMethod === "OPTIONS") {
    return {
      statusCode: 200,
      headers,
      body: ""
    };
  }

  try {
    let url = GOOGLE_SCRIPT_URL;
    let options = {
      method: event.httpMethod,
      headers: {
        "Content-Type": "application/json"
      }
    };

    // GET 요청: 쿼리 파라미터를 URL에 추가
    if (event.httpMethod === "GET") {
      const params = new URLSearchParams(event.queryStringParameters);
      url = `${GOOGLE_SCRIPT_URL}?${params.toString()}`;
    }

    // POST 요청: body 데이터 전달
    if (event.httpMethod === "POST") {
      options.body = event.body;
    }

    console.log(`📤 Proxying ${event.httpMethod} request to Google Apps Script`);
    console.log(`🔗 URL: ${url}`);

    // Google Apps Script로 요청 전달
    const response = await fetch(url, options);
    const data = await response.text();

    console.log(`✅ Response received from Google Apps Script`);

    return {
      statusCode: response.status,
      headers,
      body: data
    };

  } catch (error) {
    console.error("❌ Error in sheets-proxy:", error);
    
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        success: false,
        message: "Proxy error: " + error.message
      })
    };
  }
};
