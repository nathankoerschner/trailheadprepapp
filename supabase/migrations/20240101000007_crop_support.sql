-- Add original_image_url column to preserve the full-page image when a crop replaces image_url
alter table questions add column original_image_url text;

-- Allow tutors to update (upsert) cropped images in storage
create policy "tutors_update_test_images" on storage.objects
  for update to authenticated
  using (bucket_id = 'test-images')
  with check (bucket_id = 'test-images');
