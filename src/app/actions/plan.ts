'use server'

/**
 * 당사자의 현재 잔액과 상황에 맞춰 활동을 추천하는 서버 액션
 */
export async function suggestActivities(currentBalance: number) {
  const apiKey = process.env.OPENAI_API_KEY;

  if (!apiKey) {
    throw new Error('API 키 설정이 필요합니다.');
  }

  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: "gpt-4o",
        messages: [
          {
            role: "system",
            content: `너는 발달장애인 당사자의 자기주도적 예산 관리를 돕는 도우미야. 
            당사자가 현재 사용할 수 있는 예산은 ${currentBalance}원이야.
            이 예산 범위 내에서 즐길 수 있는 활동 1가지를 정하고, 그 활동을 즐길 수 있는 2가지 방법(저렴한 방법 vs 일반적인 방법)을 추천해줘.
            반드시 JSON 형식으로만 답변해줘.
            
            응답 형식 예시:
            {
              "activityName": "영화 보기",
              "options": [
                { "name": "조조 영화 보기", "cost": 10000, "time": "2시간", "icon": "🎬", "description": "아침 일찍 저렴하게 영화를 봐요" },
                { "name": "일반 영화 + 팝콘", "cost": 22000, "time": "2시간 30분", "icon": "🍿", "description": "맛있는 팝콘과 함께 영화를 즐겨요" }
              ]
            }`
          },
          {
            role: "user",
            content: "오늘 할 수 있는 재미있는 활동을 추천해줘."
          }
        ],
        response_format: { type: "json_object" }
      })
    });

    const data = await response.json();
    const result = JSON.parse(data.choices[0].message.content);
    
    return { success: true, data: result };
  } catch (error: any) {
    console.error('AI 추천 오류:', error);
    return { success: false, error: error.message };
  }
}
