function getNextSequence(db, name) {
  return db.collection('counters')
    .findOneAndUpdate({ _id: name }, { $inc: { seq: 1 } }, {
      returnOriginal: false,
      upsert: true
    })
    .then(result => result.value.seq);
}

const shortenUrl = (db, url) => {
  const shortenedUrls = db.collection('shortenedUrls');
  return shortenedUrls.findOne({ originalUrl: url })
    .then(doc => {
      if (doc === null) {
        return getNextSequence(db, 'short_url')
          .then(value => shortenedUrls.insertOne({
            originalUrl: url,
            shortUrl: value,
          }))
          .then(response => response.ops[0]);
      }

      return doc;
    });
};

const checkIfShortUrlCodeExists = (db, code) => db.collection('shortenedUrls')
  .findOne({ shortUrl: code })
  .then(doc => {
    if (doc === null) throw Error('shortUrlCode does not exist');

    return doc;
  });

module.exports = {
  shortenUrl,
  checkIfShortUrlCodeExists
}
