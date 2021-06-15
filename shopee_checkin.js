/*
[Script]
cron "0 7 * * *" script-path=https://raw.githubusercontent.com/morningdip/surge/master/shopee_checkin.js
shopee_getcookie.js = type=http-request,pattern=^https:\/\/shopee\.tw\/me\/setting,script-path=https://raw.githubusercontent.com/morningdip/surge/master/shopee_getcookie.js,script-update-interval=-1
[MITM]
hostname = shopee.tw
*/

var shopeeUrl = {
    url: 'https://shopee.tw/mkt/coins/api/v2/checkin',
    headers: {
      Cookie: $persistentStore.read("CookieSP"),
    }
}

$httpClient.post(shopeeUrl, function(error, response, data) {
    if (error) {
        $notification.post("Shopee Daily Check-In", "", "Check-In Failed.")
        $done();
    } else {
        if (response.status == 200) {
            let obj= JSON.parse(data);
            if (obj["data"]["success"]) {
                var user = obj["data"]["username"];
                var coins = obj["data"]["increase_coins"];
                $notification.post("Shopee Daily Check-In", "", "You have earned " + coins + " Shopee Coins.");
                $done();
            }
        } else {
            $notification.post("Shopee Cookie Expired", "", "Please login again.");
        }
    }
});
