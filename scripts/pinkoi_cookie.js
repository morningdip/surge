if ($request.headers['cookie']) {
    const cookie = $request.headers['cookie'];
    const pinkoi_token = cookie.split('sessionid=')[1].split(';')[0];
    const saveCookie = $persistentStore.write(pinkoi_token, 'CookiePinkoi');
    if (!saveCookie) {
        $notification.post("Pinkoi Cookie 保存錯誤", "", "請重新登入")
    } else {
        $notification.post("Pinkoi Cookie 保存成功", "", "")
    }
} else {
    $notification.post("Pinkoi Cookie 保存失敗", "", "請重新登入")
}
$done({})
