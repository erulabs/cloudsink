#!/bin/sh
':' //; exec "$(command -v nodejs || command -v node)" "$0" "$@"
'use strict';

var readdirp = require('readdirp');
var path = require('path');
var cli = require('commander');
var RacksJS = require('./../racksjs/dist/racks.js');
var md5 = require('MD5');
var fs = require('fs');
var ratelimit = require('rate-limit');

cli
  .option('-s, --source <dir>', 'Source directory')
  .option('-t, --target <container>', 'Cloud files container')
  .option('-u, --username <username>', 'Rackspace API username')
  .option('-k, --apikey <apikey>', 'Rackspace API key')
  .option('-f, --filter <filterString>', 'File filter - example: "*.jpg"')
  .option('-r, --region <region>', 'Rackspace Region - example: IAD, ORD')
  .option('-S, --serviceNet', 'Use Rackspace ServiceNet for transfer')
  .parse(process.argv);

if (!cli.username || !cli.apikey) {
  console.log('You did not provide a username or apikey! Use -u and -k');
  process.exit();
}
if (!cli.target) {
  console.log('You did not provide a target Cloud Files container! Use -t');
  process.exit();
}
if (!cli.source) {
  console.log('You did not provide a source directory! Use -s');
  process.exit();
}
if (!cli.region) {
  console.log('You did not provide a region! Use -r');
  process.exit();
}

// Use a queue for GETs to prevent hitting API rate limits
// Since we're uploading one at a time, it's not a big deal if this is a bit slow.
// as most of the time this will be building out the UploadQueue well ahead of the upload() function
var GetQueue = ratelimit.createQueue({ interval: 500 });
var container = false;
var UploadQueue = [];
var filesVerified = 0;
var filesFound = 0;
var newFiles = 0;
var modifiedFiles = 0;

new RacksJS({
  username: cli.username,
  apiKey: cli.apikey,
  verbosity: 0
}, function (rs) {
  var uploadStarted = false;
  rs.datacenter = cli.region;
  if (cli.serviceNet) {
    rs.network = 'internal';
  } else {
    rs.network = 'public';
  }

  // TODO: Verify container (option to create)
  container = rs.cloudFiles.containers.assume(cli.target);

  var readingDir = true;
  console.log('Downloading list of remote objects...');
  container.listAllObjects(function (existingObjects) {
    console.log('Enumerating local directory & Compairing MD5 sums...');
    readdirp({ root: path.join(cli.source), fileFilter: cli.filter })
      .on('warn', function (err) {
        console.error('something went wrong when processing an entry', err);
      })
      .on('error', function (err) {
        console.error('something went fatally wrong and the stream was aborted', err);
      })
      .on('data', function (entry) {
        syncFile(entry, existingObjects);
      })
      .on('end', function () {
        readingDir = false;
      });
  });

  function upload () {
    uploadStarted = true;
    var file = UploadQueue.shift();
    if (file) {
      // File may have been removed by now :P
      if (!fs.existsSync(file)) {
        upload();
      } else {
        var request = container.upload({
          file: file
        }, function (response) {
          if (response.statusCode !== 201) {
            console.log(file, 'Upload response code:', response.statusCode);
          } else {
            console.log('%s complete', file);
            if (UploadQueue.length !== 0) {
              upload();
            }
          }
        });
        request.on('error', function (err) {
          console.log('Connection error:', err);
        });
      }
    }
  }
  function startUploadCheck () {
    filesVerified++;
    if (filesVerified === filesFound && readingDir === false) {
      console.log('%s files verified local & remote', filesFound);
      console.log('%s files to upload', UploadQueue.length);
      if (UploadQueue.length > 0) {
        console.log('%s files are new, %s are different remotely', newFiles, modifiedFiles);
        console.log('Beginning upload');
        upload();
      }
    }
  }
  function syncFile (entry, existingObjects) {
    var remoteFileName;
    var localFileName;
    if (cli.source === '.') {
      localFileName = entry.path;
    } else {
      localFileName = cli.source + '/' + entry.path;
    }
    filesFound++;
    remoteFileName = localFileName.replace(path.sep, '/');
    // If remote file exists
    if (existingObjects.indexOf(remoteFileName) > -1) {
      GetQueue.add(function () {
        rs.get(container._racksmeta.target() + '/' + encodeURIComponent(remoteFileName), function (data, response) {
          var remoteMD5 = response.headers.etag;
          fs.readFile(remoteFileName, function(err, buf) {
            var localMD5 = md5(buf);
            if (remoteMD5 !== localMD5) {
              modifiedFiles++;
              UploadQueue.push(remoteFileName);
            }
            startUploadCheck();
          });
        });
      });
    } else {
      newFiles++;
      UploadQueue.push(remoteFileName);
      startUploadCheck();
    }
  }
});
