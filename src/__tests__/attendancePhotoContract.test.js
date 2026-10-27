import fs from 'fs';
import path from 'path';

/**
 * The attendance-photo contract.
 *
 * The photo flow spans three places that cannot see each other: a SQL patch,
 * a storage bucket, and the client. A regression in any one of them fails
 * quietly - the camera still opens, the request still succeeds, and the admin
 * queue silently shows "No photo" forever. These assertions read the real
 * files so that cannot happen unnoticed.
 */

const ROOT = process.cwd();
const SQL = fs.readFileSync(path.join(ROOT, 'PATCH_ATTENDANCE_PHOTOS.sql'), 'utf8');
const SERVICE = fs.readFileSync(path.join(ROOT, 'src/services/supabaseService.js'), 'utf8');

const stripComments = (sql) => sql.replace(/--[^\n]*/g, '');

describe('PATCH_ATTENDANCE_PHOTOS.sql', () => {
  it('adds both photo columns, idempotently', () => {
    expect(SQL).toMatch(/ADD COLUMN IF NOT EXISTS photo_in_path TEXT/i);
    expect(SQL).toMatch(/ADD COLUMN IF NOT EXISTS photo_out_path TEXT/i);
  });

  it('creates the bucket as PRIVATE', () => {
    const insert = SQL.match(/INSERT INTO storage\.buckets[\s\S]*?;/i);
    expect(insert).not.toBeNull();
    expect(insert[0]).toMatch(/'attendance-photos'/);
    // FALSE in the `public` position, and forced back to FALSE on conflict.
    expect(insert[0]).toMatch(/VALUES \('attendance-photos', 'attendance-photos', FALSE/);
    expect(insert[0]).toMatch(/SET public = FALSE/);
  });

  it('scopes storage reads to the owner or an admin', () => {
    expect(SQL).toMatch(/storage\.foldername\(name\)\)\[1\] = auth\.uid\(\)::text/i);
    expect(SQL).toMatch(/public\.is_hyt_admin\(\)/i);
  });

  it('makes set_attendance_photo SECURITY DEFINER', () => {
    // Without it the UPDATE is blocked by RLS, because `authenticated` has no
    // UPDATE grant on attendance_logs - attendance is RPC-only by design.
    expect(SQL).toMatch(/FUNCTION public\.set_attendance_photo/);
    expect(SQL).toMatch(/SECURITY DEFINER/);
    expect(SQL).toMatch(/REVOKE ALL ON FUNCTION public\.set_attendance_photo/);
    expect(SQL).toMatch(/GRANT EXECUTE ON FUNCTION public\.set_attendance_photo/);
  });

  it('refuses to replace the photo of a closed row', () => {
    // Otherwise a rejected request could be re-photographed after the fact to
    // make it look legitimate.
    expect(SQL).toMatch(/already closed; its photo cannot be replaced/i);
    expect(SQL).toMatch(/'PENDING_CLOCK_IN', 'CLOCKED_IN', 'PENDING_CLOCK_OUT'/);
  });

  it('keeps the file path inside the owner folder', () => {
    expect(SQL).toMatch(/SPLIT_PART\(p_path, '\/', 1\) <> v_row\.user_id::text/i);
  });

  it('reloads the PostgREST schema cache', () => {
    expect(SQL).toMatch(/NOTIFY pgrst, 'reload schema'/);
  });

  it('returns a single result grid, because the editor shows only the last one', () => {
    const body = stripComments(SQL);
    const selects = body.match(/^SELECT /gim) || [];
    expect(selects).toHaveLength(1);
    // psql meta-commands are rejected outright by the Supabase SQL Editor.
    expect(body).not.toMatch(/^\s*\\/m);
  });
});

describe('supabaseService photo helpers', () => {
  it('uses the same bucket name as the SQL patch', () => {
    expect(SERVICE).toMatch(/ATTENDANCE_PHOTO_BUCKET = 'attendance-photos'/);
    expect(SQL).toMatch(/'attendance-photos'/);
  });

  it('asks for a signed URL rather than a public one', () => {
    expect(SERVICE).toMatch(/createSignedUrl/);
    expect(SERVICE).not.toMatch(/getPublicUrl/);
  });

  it('surfaces the new columns to the admin queue', () => {
    expect(SERVICE).toMatch(/photo_in_path, photo_out_path/);
    expect(SERVICE).toMatch(/latitude, longitude, accuracy_meters, location_source/);
    expect(SERVICE).toMatch(/requested_at,/);
  });

  it('never lets a photo failure throw out of the upload path', () => {
    // The attendance row is already written by the time the photo is stored,
    // so a missing bucket must be reported, not raised.
    expect(SERVICE).toMatch(/recorded: false/);
  });
});
