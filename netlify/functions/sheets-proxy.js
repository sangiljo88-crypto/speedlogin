// Netlify Functions 프록시 - Google Apps Script CORS 우회
// 경로: netlify/functions/sheets-proxy.js

exports.handler = async (event, context) => {
  // CORS 헤더 설정
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS'
  };

  // OPTIONS preflight 요청 처리
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers,
      body: ''
    };
  }

  try {
    // Google Apps Script URL
    const GAS_URL = 'https://script.google.com/macros/s/AKfycbw8sZ0SKq-vMRMEsO9CM2lL01HnuILndV3nVTPXJfb3tj_MO5zjWMrMNOfIKVuFwKxw/exec';

    let fetchUrl;
    let fetchOptions = {};

    if (event.httpMethod === 'GET') {
      // GET 요청 - 쿼리 파라미터 그대로 전달
      const queryString = event.rawQuery || '';
      fetchUrl = `${GAS_URL}?${queryString}`;
      
    } else if (event.httpMethod === 'POST') {
      // POST 요청
      fetchUrl = GAS_URL;
      fetchOptions = {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: event.body
      };
    }

    // Google Apps Script 호출
    const response = await fetch(fetchUrl, fetchOptions);
    const data = await response.text();

    return {
      statusCode: 200,
      headers,
      body: data
    };

  } catch (error) {
    console.error('Proxy Error:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ 
        success: false, 
        message: 'Proxy error: ' + error.message 
      })
    };
  }
};
