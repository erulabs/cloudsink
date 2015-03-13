CloudSink
==============

A Rackspace Cloud Files directory sync tool that isn't awful

[![NPM](https://nodei.co/npm/cloudsink.png?downloads=true&downloadRank=true&stars=true)](https://nodei.co/npm/cloudsink/)

Install NodeJS and NPM:

```npm install -g cloudsink```

Upload a directory:

```cloudsink --source PATH --target CONTAINER --username ... --apikey ... --region IAD```

For very very large tasks, I recommend wrapping the command with "watch", so that the upload loops forever.

```watch 'cloudsink --source PATH --target CONTAINER --username ... --apikey ... --region IAD'```

Check the help: ```cloudsink --help```

Options to know about:

  - ```-F``` for fastmode - don't check MD5 sums of files, just validate existence by name
  - ```-S``` for ServiceNet
  - ```-f``` for filter - ex: ```-f "*.jpg"```

TODOS:

  - Allow the MD5 checking to be optional (ie: the filename is enough to skip an upload)
  - Fix issue with MD5 sum of files with special charcters in the name
  - Write a bunch of tests
  - Ensure symlink conditions work as expected
  - Support for compression (extract-archive)
