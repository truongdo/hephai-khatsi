/** A multipart POST as a browser sends it, with its Content-Length. */
export async function multipartRequest(
  url: string,
  form: FormData,
  headers: Record<string, string> = {},
): Promise<Request> {
  const encoded = new Response(form)
  const body = await encoded.arrayBuffer()
  return new Request(url, {
    method: 'POST',
    headers: {
      ...headers,
      'Content-Type': encoded.headers.get('Content-Type') ?? '',
      'Content-Length': String(body.byteLength),
    },
    body,
  })
}
