cloudsink -S -s SOURCE/PATH -t CONTAINER_NAME -u USERNAME -k API_KEY -r IAD -R 1 >> ~/upload.log


Dont set the rate limit (-R, --rate) lower than 200 (the default rate limit for PUTs is 5 per second).
