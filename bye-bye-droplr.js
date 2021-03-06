(function() {
	
	var readline = require('readline'),
		request = require('request'),
		async = require('async'),
		fs = require('fs'),

		baseUrl = 'https://droplr.com',
		downloadFolder = __dirname + '/download',
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
		    		//eg. "download/image/KbZt_Screen_Shot_2014-01-03_at_02.55.07.png"
		    		var filename = dropsList[i].code + '_' + dropsList[i].title;
		    		
		    		//remove illegal characters from filename
		    		filename = filename.replace(/[\\/:""*?<>| ]/g, '_');
		    		//if it's a note, add the correct extension
		    		if(dropsList[i].type == 'note') filename += ".txt";

			        var path = downloadFolder + '/' + dropsList[i].type + '/' + filename;
					
					fs.exists(path, function(exists) {
			        	//if the file exists already, don't download it
						if(!exists) {
							var file = fs.createWriteStream(path);
					
							file.on('open', function() {
								//ceci n'est pas un pipe
								request({
									url: dropsList[i].url + '+'
								}, function() {
									console.log('Downloaded drop ' + (i+1) + '/' + dropsList.length + ' (' + path + ')');
									i++;
									next();
								}).pipe(file);
							});
						} else {
							console.log("Skipping drop " + (i+1) + '/' + dropsList.length + ", it's already on the filesystem");
							i++;
		    				next();
						}
					});
		    	} else {
		    		console.log("Skipping drop " + (i+1) + '/' + dropsList.length + ", it's a link");
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
		        fs.mkdir(downloadFolder, callback);
		    },
		    function(callback){
		        fs.mkdir(downloadFolder + '/image/', callback);
		    },
		    function(callback){
		        fs.mkdir(downloadFolder + '/audio/', callback);
		    },
		    function(callback){
		        fs.mkdir(downloadFolder + '/video/', callback);
		    },
		    function(callback){
		        fs.mkdir(downloadFolder + '/note/', callback);
		    },
		    function(callback){
		        fs.mkdir(downloadFolder + '/file/', callback);
		    },
		], callback);
	}
	
})();