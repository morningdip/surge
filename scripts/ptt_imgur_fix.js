let body = $response.body;

body = body.replace(
  "</body>",
  '<script defer type="text/javascript" src="//cdn.jsdelivr.net/gh/gslin/imgur-links-rewriting-on-ptt/imgur-links-rewriting-on-ptt.user.js"></script></body>',
);

$done({ body });
