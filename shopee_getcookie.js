if ($request.headers['Cookie']) {
    var headerSP = $request.headers['Cookie'];
    var cookie = $persistentStore.write(headerSP, "CookieSP");
    if (!cookie) {
      $notification.post("Shopee Cookie Error ‼️", "", "Try again later")
    } else {
      $notification.post("Shopee Cookie Get 🎉🎉", "", "")
    }
} else {
    $notification.post("Shopee Cookie Error ‼️", "", "Try again later")
}

$done({})
