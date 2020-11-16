/*
[Script]
cron "0 6 * * *" script-path=shopee_checkin.js

http-request ^https:\/\/shopee\.tw\/me\/setting max-size=0,script-path=shopee_getcookie.js

MITM = shopee.tw
*/

var shopeeUrl = {
    url: 'https://shopee.tw/mkt/coins/api/v2/checkin',
    headers: {
      Cookie: $persistentStore.read("CookieSP"),
    }
}

$httpClient.post(shopeeUrl, function(error, response, data) {
    if (error) {
        $notification.post("Shopee Checkin", "", "Failed ‼️")
        $done();
    } else {
        if (response.status == 200) {
            let obj= JSON.parse(data);
            if (obj["data"]["success"]) {
                var user = obj["data"]["username"];
                var coins = obj["data"]["increase_coins"];
                $notification.post("Shopee " + user, "", " gets " + coins + "💰");
                $done();
            }
        } else {
            $notification.post("Shopee Cookie Expired ‼️", "", "Please login again 🔓");
        }
    }
});
