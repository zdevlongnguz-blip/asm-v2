import test from 'node:test';
import assert from 'node:assert/strict';
import axios from 'axios';
import app from '../src/app.js';

import { getWikiSummary, getWikiSummaryWithThumbnail, getWikiArticle } from '../src/services/wiki.js';

test('getWikiSummary returns a short summary string', async () => {
  const originalGet = axios.get;
  axios.get = async (url, config) => {
    assert.equal(url, 'https://en.wikipedia.org/w/api.php');
    assert.equal(config.params.titles, 'JavaScript');
    assert.equal(config.params.exintro, 1);
    assert.equal(config.params.explaintext, 1);

    return {
      data: {
        query: {
          pages: {
            123: {
              title: 'JavaScript',
              extract: 'JavaScript is a programming language.',
            },
          },
        },
      },
    };
  };

  try {
    const result = await getWikiSummary('JavaScript');
    assert.equal(result, 'JavaScript is a programming language.');
  } finally {
    axios.get = originalGet;
  }
});

test('getWikiArticle returns the full article text', async () => {
  const originalGet = axios.get;
  axios.get = async (url, config) => {
    assert.equal(url, 'https://en.wikipedia.org/w/api.php');
    assert.equal(config.params.titles, 'JavaScript');
    assert.equal(config.params.explaintext, 1);
    assert.equal(config.params.exintro, undefined);

    return {
      data: {
        query: {
          pages: {
            123: {
              title: 'JavaScript',
              extract: 'JavaScript is a programming language. It runs in browsers.',
            },
          },
        },
      },
    };
  };

  try {
    const result = await getWikiArticle('JavaScript');
    assert.equal(result, 'JavaScript is a programming language. It runs in browsers.');
  } finally {
    axios.get = originalGet;
  }
});

// [THUMBNAIL: new] Verify the combined Wikipedia query and metadata shape used by the API and UI.
test('getWikiSummaryWithThumbnail returns summary and optional page image metadata', async () => {
  const originalGet = axios.get;
  axios.get = async (url, config) => {
    assert.equal(config.params.titles, 'Thumbnail Test Article');
    assert.equal(config.params.exintro, 1);
    assert.equal(config.params.prop, 'extracts|pageimages');
    assert.equal(config.params.pithumbsize, 500);

    return {
      data: {
        query: {
          pages: {
            456: {
              title: 'Thumbnail Test Article',
              extract: 'A short article summary.',
              thumbnail: {
                source: 'https://example.com/thumbnail.jpg',
                width: 500,
                height: 300,
              },
            },
          },
        },
      },
    };
  };

  try {
    const result = await getWikiSummaryWithThumbnail('Thumbnail Test Article');
    assert.deepEqual(result, {
      title: 'Thumbnail Test Article',
      summary: 'A short article summary.',
      thumbnail: {
        source: 'https://example.com/thumbnail.jpg',
        width: 500,
        height: 300,
      },
    });
  } finally {
    axios.get = originalGet;
  }
});

// [THUMBNAIL: new] Articles without an image still return a usable summary.
test('getWikiSummaryWithThumbnail returns null when the article has no thumbnail', async () => {
  const originalGet = axios.get;
  axios.get = async (url, config) => ({
    data: {
      query: {
        pages: {
          457: {
            title: 'No Thumbnail Test Article',
            extract: 'An article without an image.',
          },
        },
      },
    },
  });

  try {
    const result = await getWikiSummaryWithThumbnail('No Thumbnail Test Article');
    assert.equal(result.summary, 'An article without an image.');
    assert.equal(result.thumbnail, null);
  } finally {
    axios.get = originalGet;
  }
});

// [THUMBNAIL: new] Ensure the existing summary API adds thumbnail metadata without dropping summary.
test('GET /api/wiki/summary/:title returns summary and thumbnail', async () => {
  const originalGet = axios.get;
  axios.get = async (url, config) => {
    assert.equal(config.params.titles, 'Route Thumbnail Test');
    return {
      data: {
        query: {
          pages: {
            458: {
              title: 'Route Thumbnail Test',
              extract: 'Summary from Wikipedia.',
              thumbnail: { source: 'https://example.com/route-thumbnail.jpg', width: 500, height: 300 },
            },
          },
        },
      },
    };
  };

  const server = app.listen(0);

  try {
    await new Promise((resolve) => server.once('listening', resolve));
    const { port } = server.address();
    const response = await fetch(`http://localhost:${port}/api/wiki/summary/Route_Thumbnail_Test`);
    const result = await response.json();

    assert.equal(response.status, 200);
    assert.deepEqual(result, {
      title: 'Route Thumbnail Test',
      summary: 'Summary from Wikipedia.',
      thumbnail: { source: 'https://example.com/route-thumbnail.jpg', width: 500, height: 300 },
    });
  } finally {
    await new Promise((resolve) => server.close(resolve));
    axios.get = originalGet;
  }
});
