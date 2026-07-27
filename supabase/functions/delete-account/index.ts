Deno.serve(async (request) => {
  return Response.json(
    {
      ok: false,
      error: 'This endpoint has been retired. Use the recent-authenticated account-security flow.'
    },
    {
      status: 410,
      headers: {
        'cache-control': 'no-store',
        'x-migration-target': 'account-security'
      }
    }
  );
});
