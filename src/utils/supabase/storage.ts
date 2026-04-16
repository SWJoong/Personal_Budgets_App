/**
 * Storage 유틸리티
 * - Public URL에서 storage 경로 추출
 * - Private 버킷 전환 이후에도 경로 기반 signed URL 생성에 사용
 */

/**
 * DB에 저장된 public URL에서 storage 오브젝트 경로를 추출합니다.
 * 예) https://xxx.supabase.co/storage/v1/object/public/receipts/abc/123.jpg
 *  → "abc/123.jpg"
 */
export function extractStoragePath(publicUrl: string, bucket: string): string | null {
  if (!publicUrl) return null
  // public 버킷 URL 형식
  const publicMarker = `/object/public/${bucket}/`
  const publicIdx = publicUrl.indexOf(publicMarker)
  if (publicIdx !== -1) return publicUrl.slice(publicIdx + publicMarker.length)

  // authenticated 버킷 URL 형식 (이미 signed URL인 경우 등)
  const authMarker = `/object/authenticated/${bucket}/`
  const authIdx = publicUrl.indexOf(authMarker)
  if (authIdx !== -1) return publicUrl.slice(authIdx + authMarker.length)

  return null
}
