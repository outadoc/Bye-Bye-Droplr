(function() {
	
	var readline = require('readline'),
		request = require('request'),
		async = require('async'),
		fs = require('fs'),

		baseUrl = 'https://droplr.com',
		username, password,

		cookieJar = request.jar(),

		rl = readline.createInterface({
			input: process.stdin,
			output: process.stdout
		});

	rl.question("Droplr.com Email: ", function(answer1) {
		username = answer1;

		rl.question("Droplr.com Password: ", function(answer2) {
			password = answer2;
			rl.close();

			//we got the username and password
			loginToDroplr(username, password, function() {
				//we're logged in
				getCompleteDropsList(function(data) {
					//we've got the drops list
					initDirStructure(function() {
						//fs is initialized
						downloadAllDrops(data, function() {
							console.log("Everything was downloaded! (" + data.length + " drops)");
							console.log("Bye-bye, Droplr.");
						});
					});
				});
			});
		});
	});

	function loginToDroplr(username, password, callback) {
		console.log('Logging in...');

		request({
			method: 'POST',
			url: baseUrl + '/login',
			jar: cookieJar,
			followAllRedirects: true,
			form: {
				"user[email]": username,
				"user[password]": password,
				utf8: '✓',
			}
		}, function(e, r, body) {
			if(e != null || body == null || body.indexOf('auth-header') != -1) {
				console.log('Failed to log in.');
				process.exit(1);
			}

			console.log('Logged in successfuly!');
			callback();
		});
	}

	function getCompleteDropsList(callback) {
		var offset = 0,
			dropsList = [],
			lastData = {};

		console.log('Loading drops list...');

		//get all the drops, with a step of 100
		async.doWhilst(
			function(next) {
				//request 100 drops
				request({
					url: baseUrl + '/drops',
					json: true,
					form: {
						type: 'all',
						amount: 100,
						offset: offset,
						sortBy: 'creation',
						order: 'desc',
						search: ''
					},
					headers: {
						'Accept': 'application/json'
					},
					jar: cookieJar,
					followAllRedirects: true
				}, function(e, r, data) {
					lastData = data;
					dropsList = dropsList.concat(data);

					console.log(dropsList.length + ' drops loaded, and still counting...');

					offset += 100;
					next();
				});
			},
			function() {
				//if we didn't get anything from the last request, we're done
				return lastData != null && lastData.length != 0;
			},
			function(err) {
				//yay!
				dropsList.pop();
				console.log('Successfuly loaded ' + dropsList.length + ' drops!');
				callback(dropsList);
			}
		);
	}

	function downloadAllDrops(dropsList, callback) {
		var i = 0;

		//async.whilst is more or less a cool synchronous while loop
		async.whilst(
		    function () { return i < dropsList.length; },
		    function (next) {
		    	//don't save it if it's a just a link
		    	if(dropsList[i].type != 'link') {
		    		//eg. "download/image/KbZt_Screen Shot 2014-01-03 at 02.55.07.png"
			        var path = "./download/" + dropsList[i].type + '/' + dropsList[i].code + '_' + dropsList[i].title,
						file = fs.createWriteStream(path);
					
					file.on('open', function() {
						//ceci n'est pas un pipe
						request({
							url: dropsList[i].url + '+'
						}, function() {
							console.log('Downloaded drop ' + i + '/' + dropsList.length + ' (' + path + ')');
							next();
						}).pipe(file);
					});

					i++;
		    	} else {
		    		console.log("Skipping drop " + i + '/' + dropsList.length + ", it's a link");
		    		i++;
		    		next();
		    	}
		    },
		    function (err) {
		        callback();
		    }
		);
	}

	//creates all the directories needed to download the drops
	function initDirStructure(callback) {
		async.parallel([
			function(callback){
		        fs.mkdir('./download', callback);
		    },
		    function(callback){
		        fs.mkdir('./download/image/', callback);
		    },
		    function(callback){
		        fs.mkdir('./download/audio/', callback);
		    },
		    function(callback){
		        fs.mkdir('./download/video/', callback);
		    },
		    function(callback){
		        fs.mkdir('./download/note/', callback);
		    },
		    function(callback){
		        fs.mkdir('./download/file/', callback);
		    },
		], callback);
	}
	
})();