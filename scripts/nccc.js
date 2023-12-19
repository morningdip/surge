let body = $response.body;
// change type to number
body = body.replace(/type="password"/g, 'type="number"');
body = body.replace(/autocomplete="off"/g, 'autocomplete="one-time-code"');
$done({ body });
