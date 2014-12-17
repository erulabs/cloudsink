'use strict';

var readdirp = require('readdirp');
var path = require('path');
var cli = require('commander');
var RacksJS = require('racksjs');
var md5 = require('MD5');
var fs = require('fs');

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

new RacksJS({
  username: cli.username,
  apiKey: cli.apikey,
  verbosity: 0
}, function (rs) {

  rs.datacenter = cli.region;
  if (cli.serviceNet) {
    rs.network = 'internal';
  } else {
    rs.network = 'public';
  }

  // TODO: Verify container (option to create)
  var container = rs.cloudFiles.containers.assume(cli.target);

  container.listObjects(function (existingObjects) {
    readdirp({ root: path.join(cli.source), fileFilter: cli.filter })
      .on('warn', function (err) {
        console.error('something went wrong when processing an entry', err);
      })
      .on('error', function (err) {
        console.error('something went fatally wrong and the stream was aborted', err);
      })
      .on('data', function (entry) {
        var remoteFileName;
        if (cli.source === '.') {
          remoteFileName = entry.path;
        } else {
          remoteFileName = cli.source + path.sep + entry.path;
        }
        if (existingObjects.indexOf(remoteFileName) === -1) {
          console.log('uploading %s...', remoteFileName);
          container.upload({
            file: remoteFileName
          }, function (reply) {
            console.log(reply.statusCode);
          });
        } else {
          rs.get(container._racksmeta.target() + '/' + remoteFileName, function (data, response) {
            var remoteMD5 = response.headers.etag;
            fs.readFile(remoteFileName, function(err, buf) {
              if (remoteMD5 === md5(buf)) {
                console.log('%s already exists remotely', remoteFileName);
              } else {
                console.log('MD5 mismatch - uploading local file');
                container.upload({
                  file: remoteFileName
                }, function (reply) {
                  console.log(reply.statusCode);
                });
              }
            });
          });
        }
      });
  });
});
