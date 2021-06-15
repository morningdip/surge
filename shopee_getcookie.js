/*
[Script]
shopee_getcookie.js= type=http-request,pattern=^https:\/\/shopee\.tw\/me\/setting,script-path=https://raw.githubusercontent.com/morningdip/surge/master/shopee_getcookie.js,script-update-interval=-1
[MITM]
hostname= shopee.tw
*/

if ($request.headers['Cookie']) {
    var headerSP = $request.headers['Cookie'];
    var cookie = $persistentStore.write(headerSP, "CookieSP");
    if (!cookie) {
      $notification.post("Shopee Cookie", "", "Error! Try again later")
    } else {
      $notification.post("Shopee Cookie", "", "Get cookie!")
    }
} else {
    $notification.post("Shopee Cookie", "", "Error! Try again later")
}

$done({})
