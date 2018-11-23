angular.module("app", [])
.value("rouletteAbi", [{"constant":false,"inputs":[{"name":"amount","type":"uint256"}],"name":"withdraw","outputs":[],"payable":false,"stateMutability":"nonpayable","type":"function"},{"constant":false,"inputs":[{"name":"betType","type":"uint8"},{"name":"betValue","type":"uint8"}],"name":"placeBet","outputs":[],"payable":true,"stateMutability":"payable","type":"function"},{"inputs":[],"payable":false,"stateMutability":"nonpayable","type":"constructor"},{"payable":true,"stateMutability":"payable","type":"fallback"},{"anonymous":false,"inputs":[{"indexed":true,"name":"player","type":"address"},{"indexed":true,"name":"round","type":"uint256"},{"indexed":false,"name":"betType","type":"uint8"},{"indexed":false,"name":"betValue","type":"uint8"},{"indexed":false,"name":"stake","type":"uint256"},{"indexed":false,"name":"payout","type":"uint256"},{"indexed":false,"name":"win","type":"bool"},{"indexed":false,"name":"result","type":"uint8"}],"name":"Bet","type":"event"},{"anonymous":false,"inputs":[{"indexed":true,"name":"round","type":"uint256"},{"indexed":false,"name":"result","type":"uint8"}],"name":"Result","type":"event"}])
.filter("fromWei", function ($window) {
	return function (input, unit) {
		input = input || "";
		unit  = unit  || "ether";
		if ($window.web3) {
			return $window.web3.fromWei(input, unit);
		}
		return input;
	}
})
.filter("winLose", function () {
	return function (input) {
		if (input) {
			return "Win";
		} else {
			return "Lose";
		}
	}
})
.directive("blockies", function ($window) {
	return {
		restrict  : "E",
		scope     : {
			value : "=value",
			size  : "@size"
		},
		link      : function (scope, element) {
			var size = scope.size || 8;
			var str  = scope.value;
			if ($window.web3) {
				str = web3.toChecksumAddress(str);
			}
			var icon = blockies.create({
				seed     : str,
				size     : size,
				color    : "#e84501",
				bgcolor  : "#ffd800",
				spotcolor : "#88ea62"
			})
			element.append(icon);
		}
	}
})
.controller("AppCtrl", function ($scope, $window, $timeout, rouletteAbi) {
	$scope.page       = 0;
	$scope.hasWeb3    = false;
	$scope.authorized = false;
	$scope.allHistory = [];

	$scope.contractAddress = "0xC90C16393D2d1d4746bfb90369C1F5E6416b71d4";

	var Roulette, roulette;
	var myLastTxHash, allLastTxHash;
	var myBetEvent;
	var filter = {
		fromBlock : 4478172,
		toBlock   : "latest"
	}

	if ($window.web3 && $window.ethereum) {
		$scope.hasWeb3 = true;
		ethereum.enable()
		.then(function (address) {
			try {
				$scope.$apply(function () {
					onApproval(address);
				});
			} catch (e) {
				console.error(e);
			}
		})
		.catch(onReject);
	}


	function onApproval(address) {
		$scope.authorized = true;

		Roulette = web3.eth.contract(rouletteAbi);
		roulette = Roulette.at($scope.contractAddress);

		var globalBetEvent = roulette.Bet({}, filter);

		globalBetEvent.watch(function (err, result) {
			if (allLastTxHash && allLastTxHash == result.transactionHash) {
				// skip; duplicate record.
				return ;
			}
			allLastTxHash  = result.transactionHash;
			$scope.$apply(function () {
				$scope.allHistory.splice(0, 0, result);
			});
		});

		trackAccount();
	}

	function onReject(err) {
		console.log("Request to access wallet failed. ERR: " + err);
		$window.alert("Request to access wallet failed. ERR: " + err);
	}

	function initMyAccount(address) {
		if (myBetEvent) {
			console.log("Stop watching previous event");
			myBetEvent.stopWatching();
		}

		$scope.myAddress = address;
		web3.eth.getBalance(address, function (err, balance) {
			$scope.$apply(function () {
				$scope.balance = balance;
			});
		});

		$scope.myHistory  = [];

		myBetEvent = roulette.Bet({ player : address }, filter);
		myBetEvent.watch(function (err, result) {
			if (myLastTxHash && myLastTxHash == result.transactionHash) {
				// skip; duplicate record.
				return ;
			}
			myLastTxHash = result.transactionHash;
			$scope.$apply(function () {
				$scope.myHistory.splice(0, 0, result);
			});
		});
	}

	function trackAccount() {
		if (web3.eth.accounts[0] !== $scope.myAddress) {
			initMyAccount(web3.eth.accounts[0]);
		}
		$timeout(trackAccount, 100);
	}
})
