-- 19_storage_buckets.sql
-- Supabase Storage 버킷 생성 및 RLS 정책 설정

-- ── 버킷 생성 ──────────────────────────────────────────────────
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES
  ('receipts',        'receipts',        true, 10485760, ARRAY['image/jpeg','image/png','image/webp','image/heic','image/heif','application/pdf']),
  ('activity-photos', 'activity-photos', true, 10485760, ARRAY['image/jpeg','image/png','image/webp','image/heic','image/heif']),
  ('documents',       'documents',       true, 20971520, NULL)   -- 문서는 MIME 제한 없음, 최대 20MB
ON CONFLICT (id) DO UPDATE SET
  file_size_limit     = EXCLUDED.file_size_limit,
  allowed_mime_types  = EXCLUDED.allowed_mime_types;

-- ── receipts 버킷 정책 ─────────────────────────────────────────
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = 'receipts_insert'
  ) THEN
    CREATE POLICY "receipts_insert" ON storage.objects
      FOR INSERT TO authenticated
      WITH CHECK (bucket_id = 'receipts');
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = 'receipts_select'
  ) THEN
    CREATE POLICY "receipts_select" ON storage.objects
      FOR SELECT TO public
      USING (bucket_id = 'receipts');
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = 'receipts_delete'
  ) THEN
    CREATE POLICY "receipts_delete" ON storage.objects
      FOR DELETE TO authenticated
      USING (bucket_id = 'receipts');
  END IF;
END $$;

-- ── activity-photos 버킷 정책 ──────────────────────────────────
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = 'activity_photos_insert'
  ) THEN
    CREATE POLICY "activity_photos_insert" ON storage.objects
      FOR INSERT TO authenticated
      WITH CHECK (bucket_id = 'activity-photos');
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = 'activity_photos_select'
  ) THEN
    CREATE POLICY "activity_photos_select" ON storage.objects
      FOR SELECT TO public
      USING (bucket_id = 'activity-photos');
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = 'activity_photos_delete'
  ) THEN
    CREATE POLICY "activity_photos_delete" ON storage.objects
      FOR DELETE TO authenticated
      USING (bucket_id = 'activity-photos');
  END IF;
END $$;

-- ── documents 버킷 정책 ────────────────────────────────────────
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = 'documents_insert'
  ) THEN
    CREATE POLICY "documents_insert" ON storage.objects
      FOR INSERT TO authenticated
      WITH CHECK (bucket_id = 'documents');
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = 'documents_select'
  ) THEN
    CREATE POLICY "documents_select" ON storage.objects
      FOR SELECT TO authenticated
      USING (bucket_id = 'documents');
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = 'documents_delete'
  ) THEN
    CREATE POLICY "documents_delete" ON storage.objects
      FOR DELETE TO authenticated
      USING (bucket_id = 'documents');
  END IF;
END $$;
