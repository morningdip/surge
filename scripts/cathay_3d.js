let body = $response.body;
// change type to number
body = body.replace(/type="password"/g, 'type="text" maxlength="4" inputmode="numeric"');
body = body.replace(/autocomplete="off"/g, 'autocomplete="one-time-code" autocorrect="off"');
$done({ body });
