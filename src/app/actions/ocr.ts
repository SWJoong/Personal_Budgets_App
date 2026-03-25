'use server'

/**
 * 영수증 이미지를 분석하여 데이터를 추출하는 서버 액션
 */
export async function analyzeReceipt(base64Image: string) {
  const apiKey = process.env.OPENAI_API_KEY;

  if (!apiKey) {
    console.error('OPENAI_API_KEY가 설정되지 않았습니다.');
    return { success: false, error: 'API 키 설정이 필요합니다.' };
  }

  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: "gpt-5",
        messages: [
          {
            role: "system",
            content: "너는 영수증 분석 전문가야. 이미지에서 '날짜(YYYY-MM-DD)', '합계 금액(숫자만)', '상호명(활동 내용)'을 찾아 반드시 JSON 형식으로만 답변해줘. 결과 예시: {\"date\": \"2026-03-24\", \"amount\": 15000, \"store\": \"스타벅스\"}"
          },
          {
            role: "user",
            content: [
              {
                type: "text",
                text: "이 영수증에서 날짜, 금액, 상호명을 추출해줘."
              },
              {
                type: "image_url",
                image_url: {
                  url: `data:image/jpeg;base64,${base64Image}`
                }
              }
            ]
          }
        ],
        response_format: { type: "json_object" },
        max_tokens: 300
      })
    });

    const data = await response.json();
    
    if (data.error) {
      throw new Error(data.error.message);
    }

    const result = JSON.parse(data.choices[0].message.content);
    return {
      success: true,
      data: {
        date: result.date,
        amount: result.amount,
        store: result.store
      }
    };
  } catch (error: any) {
    console.error('OCR 분석 오류:', error);
    return { success: false, error: error.message };
  }
}
