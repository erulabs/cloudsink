#!/bin/sh
':' //; exec "$(command -v nodejs || command -v node)" "$0" "$@"
'use strict';

var readdirp = require('readdirp');
var path = require('path');
var cli = require('commander');
var RacksJS = require('racksjs');
var RacksJS = require('/Users/sean6011/projects/racksjs/dist/racks.js');
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
var QuickQueue = ratelimit.createQueue({ interval: 500 });
var container = false;

var UploadQueue = [];

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

  container.listObjects(function (existingObjects) {
    readdirp({ root: path.join(cli.source), fileFilter: cli.filter })
      .on('warn', function (err) {
        console.error('something went wrong when processing an entry', err);
      })
      .on('error', function (err) {
        console.error('something went fatally wrong and the stream was aborted', err);
      })
      .on('data', function (entry) {
        syncFile(entry, existingObjects);
      });
  });

  function upload () {
    uploadStarted = true;
    var file = UploadQueue.shift();
    if (file) {
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
  function syncFile (entry, existingObjects) {
    var remoteFileName;
    if (cli.source === '.') {
      remoteFileName = entry.path;
    } else {
      remoteFileName = cli.source + path.sep + entry.path;
    }
    // If remote file exists
    if (existingObjects.indexOf(remoteFileName) > -1) {
      QuickQueue.add(function () {
        rs.get(container._racksmeta.target() + '/' + encodeURIComponent(remoteFileName), function (data, response) {
          var remoteMD5 = response.headers.etag;
          fs.readFile(remoteFileName, function(err, buf) {
            var localMD5 = md5(buf);
            if (remoteMD5 !== localMD5) {
              UploadQueue.push(remoteFileName);
              if (!uploadStarted) {
                upload();
              }
            }
          });
        });
      });
    } else {
      UploadQueue.push(remoteFileName);
      if (!uploadStarted) {
        upload();
      }
    }
  }
});
