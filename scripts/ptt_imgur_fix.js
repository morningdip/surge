let body = $response.body;

body = body.replace(
  "</body>",
  '<script defer type="text/javascript" src="//raw.githubusercontent.com/gslin/imgur-links-rewriting-on-ptt/refs/heads/master/imgur-links-rewriting-on-ptt.user.js"></script></body>',
);

$done({ body });
