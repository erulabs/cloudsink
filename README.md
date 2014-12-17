CloudSink
==============

A Rackspace Cloud Files directory sync tool that isn't awful

```cloudsink --source PATH --target CONTAINER --username ... --apikey ... --region IAD```

Things to know:

  - Dont set the rate limit (-R, --rate) lower than 200 (the default rate limit for PUTs is 5 per second).
  - This has been tested on a directory with 135,000 files. Please let me know if you run into ANY conditions it cannot handle! My one concern is that the rate limiting is not smart enough. Play it safe. --rate below 500 may or may not fail. If your files are very very large, you'll easily hit your limits.

TODOS:

  - Allow the MD5 checking to be optional (ie: the filename is enough to skip an upload)
  - Possibly rate limit uploads directly (to 100% ensure rate limits are never exceeded). Right now, files are simply operated on at a certain interval. This means the operator has to set a smart interval.
  - Write a bunch of tests
  - Ensure symlink conditions work as expected
  - Support for compression (extract-archive)
