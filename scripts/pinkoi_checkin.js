var checkinURL = {
    url: 'https://www.pinkoi.com/apiv2/mission_game/daily_signin',
    headers: {
        'Cookie': 'sessionid=' + $persistentStore.read("CookiePinkoi") + ';',
    }
};

var pointsInfoURL = {
    url: 'https://api.pinkoi.com/coin/get_coins',
    headers: {
        'Cookie': 'sessionid=' + $persistentStore.read("CookiePinkoi") + ';',
    },
};

function checkin() {
    $httpClient.post(checkinURL, function(error, response, data) {
        if (error) {
            $notification.post('Pinkoi Cookie', '', '連線錯誤');
            $done();
        } else {
            if (response.status == 200) {
                getPointsInfo();
                $done();
            } else {
                $notification.post('Pinkoi Cookie 失敗', '', '請重新登入');
            }
        }
    });
}

function getPointsInfo() {
    $httpClient.get(pointsInfoURL, function(error, response, data) {
        if (error) {
            $notification.post("Pinkoi 每日登入失敗", "", "連線錯誤")
            $done();
        } else {
            if (response.status == 200) {
                let obj = JSON.parse(data);
                var point = obj["result"][0]["balance"];
                $notification.post("Pinkoi 已登入", "", "P Coins 已累積 " + point);
                $done();
            } else {
                $notification.post("Pinkoi Cookie 已過期", "", "請重新登入");
                $done();
            }
        }
    });
}

checkin();
