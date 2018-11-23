angular.module("app", [])
.value("abi", [])
.value("contractAddress", "")
.value("startBlock", "")
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
.controller("AppCtrl", function ($rootScope, $window) {
	$rootScope.hasWeb3    = false;
	$rootScope.authorized = false;

	if ($window.web3 && $window.ethereum) {
		$rootScope.hasWeb3 = true;
		ethereum.enable()
		.then(function (address) {
			$rootScope.authorized = true;
			$rootScope.$emit("ethereum", address);
		})
		.catch(onReject);
	} else if ($window.web3 && $window.web3.eth.accounts.length > 0) {
		// without ethereum plugin
		$rootScope.hasWeb3    = true;
		$rootScope.authorized = true;
		$rootScope.$emit("ethereum", web3.eth.accounts);
	}

	function onReject(err) {
		console.log("Request to access wallet failed. ERR: " + err);
		$window.alert("Request to access wallet failed. ERR: " + err);
	}
})
.controller("GameCtrl", function ($rootScope, $scope, $window, $timeout, abi, contractAddress, startBlock) {
	$scope.page       = 0;
	$scope.allHistory = [];
	$scope.leadership = [];
	$scope.contractAddress = contractAddress;

	var Contract, contract;
	var myLastTxHash, allLastTxHash;
	var myBetEvent;
	var userData = {};
	var filter   = {
		fromBlock : startBlock,
		toBlock   : "latest"
	}

	$rootScope.$on("ethereum", onApproval);

	updateAccountBalance();
	updateContractBalance();

	function onApproval(address) {
		$scope.authorized = true;

		Contract = web3.eth.contract(abi);
		contract = Contract.at($scope.contractAddress);

		var globalBetEvent = contract.Bet({}, filter);

		globalBetEvent.watch(function (err, result) {
			if (allLastTxHash && allLastTxHash == result.transactionHash) {
				// skip; duplicate record.
				return ;
			}
			allLastTxHash  = result.transactionHash;
			$scope.$apply(function () {
				if (!userData[result.args.player]) {
					userData[result.args.player] = {
						player      : result.args.player,
						totalStake  : web3.toBigNumber(0, 10),
						totalPayout : web3.toBigNumber(0, 10),
						profitLoss  : web3.toBigNumber(0, 10),
						totalBets   : 0
					};
					$scope.leadership.push(userData[result.args.player]);
				}
				var user = userData[result.args.player];
				user.totalStake  = user.totalStake.add(result.args.stake);
				user.totalPayout = user.totalPayout.add(result.args.payout);
				user.profitLoss  = user.totalPayout.minus(user.totalStake);
				user.totalBets++;

				$scope.allHistory.splice(0, 0, result);
			});
		});

		trackAccount();
	}

	function initMyAccount(address) {
		if (myBetEvent) {
			console.log("Stop watching previous event");
			myBetEvent.stopWatching();
		}

		$scope.myAddress = address;
		$scope.myHistory = [];

		myBetEvent = contract.Bet({ player : address }, filter);
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

	function updateAccountBalance() {
		if ($scope.myAddress && $window.web3) {
			web3.eth.getBalance($scope.myAddress, function (err, balance) {
				if (!err) {
					$scope.$apply(function () {
						$scope.balance = balance;
					});
				}
				$timeout(updateAccountBalance, 100);
			});
		} else {
			$timeout(updateAccountBalance, 100);
		}
	}

	function updateContractBalance() {
		if ($window.web3) {
			web3.eth.getBalance($scope.contractAddress, function (err, balance) {
				if (!err) {
					$scope.$apply(function () {
						$scope.contractBalance = balance;
					});
				}
				$timeout(updateContractBalance, 100);
			});
		}
	}
});
