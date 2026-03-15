export default async function handler(req, res) {
  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }
  return res.status(200).json({ ok: true });
}
