export async function callOpenAI(
  messages: { role: string; content: string }[],
  options?: { model?: string }
): Promise<Record<string, unknown>> {
  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) throw new Error('OPENAI_API_KEY 설정이 필요합니다.')

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: options?.model ?? 'gpt-4o',
      messages,
      response_format: { type: 'json_object' },
    }),
  })

  if (!response.ok) throw new Error(`OpenAI 오류: ${response.status}`)
  const data = await response.json()
  return JSON.parse(data.choices[0].message.content)
}
