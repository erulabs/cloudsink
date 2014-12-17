CloudSink
==============

A Rackspace Cloud Files directory sync tool that isn't awful

Install NodeJS and NPM:

```npm install -g cloudsink```

Upload a directory:

```cloudsink --source PATH --target CONTAINER --username ... --apikey ... --region IAD```

For very very large tasks, I recommend wrapping the command with "watch", so that the upload loops forever.

```watch 'cloudsink --source PATH --target CONTAINER --username ... --apikey ... --region IAD'```

Check the help: ```cloudsink --help```

Options to know about:

  - ```-S``` for ServiceNet

TODOS:

  - Allow the MD5 checking to be optional (ie: the filename is enough to skip an upload)
  - Fix issue with MD5 sum of files with special charcters in the name
  - Write a bunch of tests
  - Ensure symlink conditions work as expected
  - Support for compression (extract-archive)
