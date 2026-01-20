require("dotenv").config();
const express = require("express");
const cors = require("cors");
const morgan = require("morgan");
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const app = express();
const port = process.env.PORT || 5000;

// Middleware
app.use(express.json());
app.use(cors());
app.use(morgan("dev"));

const uri = `mongodb+srv://${process.env.MONGO_USER}:${process.env.MONGO_PASS}@mrb.saeddyn.mongodb.net/?appName=MRB`;

const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

async function run() {
  try {
    await client.connect();

    const db = client.db("Advanced_Edu");
    const newsCollection = db.collection("news");

    // ========== NEWS RELATED APIs ==========

    // Fetch news from NewsData API and store in DB
    app.get("/news", async (req, res) => {
      const { country, category, language, from, to } = req.query;

      try {
        // Build NewsData API URL
        let url = `https://newsdata.io/api/1/latest?apikey=${process.env.NEWSDATA_API_KEY}`;
        if (country) url += `&country=${country}`;
        if (category) url += `&category=${category}`;
        if (language) url += `&language=${language}`;
        if (from) url += `&from_date=${from}`;
        if (to) url += `&to_date=${to}`;

        // Fetch from NewsData API
        const response = await fetch(url);
        const data = await response.json();

        if (data.results && data.results.length > 0) {
          // Store in database with complete structure
          const bulkOps = data.results.map((article) => ({
            updateOne: {
              filter: { article_id: article.article_id }, // Use article_id as unique identifier
              update: {
                $set: {
                  article_id: article.article_id,
                  title: article.title,
                  description: article.description,
                  link: article.link,
                  image_url: article.image_url,
                  video_url: article.video_url,
                  pubDate: article.pubDate,
                  pubDateTZ: article.pubDateTZ,
                  category: article.category, // Array
                  country: article.country, // Array
                  language: article.language,
                  creator: article.creator, // Array
                  keywords: article.keywords, // Array
                  source_id: article.source_id,
                  source_name: article.source_name,
                  source_url: article.source_url,
                  source_icon: article.source_icon,
                  source_priority: article.source_priority,
                  duplicate: article.duplicate,
                  datatype: article.datatype,
                  fetched_at: article.fetched_at,
                  // Store filter used to fetch this article
                  searchFilters: {
                    country: country,
                    category: category,
                    language: language,
                    from: from,
                    to: to,
                  },
                  // Timestamp when saved to DB
                  storedAt: new Date(),
                },
              },
              upsert: true,
            },
          }));

          await newsCollection.bulkWrite(bulkOps);
        }

        res.send(data.results || []);
      } catch (error) {
        console.error("Error fetching news:", error);
        res.status(500).send({ error: "Failed to fetch news" });
      }
    });

    // Get stored news from DB with filters
    app.get("/news/stored", async (req, res) => {
      const { country, category, language, source } = req.query;

      const filter = {};

      // Match arrays properly
      if (country) filter.country = country;
      if (category) filter.category = category;
      if (language) filter.language = language;
      if (source) filter.source_id = source;

      const cursor = newsCollection
        .find(filter)
        .sort({ pubDate: -1 })
        .limit(50);
      const result = await cursor.toArray();

      res.send(result);
    });

    // Get all stored news
    app.get("/news/all", async (req, res) => {
      const cursor = newsCollection.find().sort({ storedAt: -1 }).limit(100);
      const result = await cursor.toArray();
      res.send(result);
    });

    // Get news by category
    app.get("/news/category/:category", async (req, res) => {
      const { category } = req.params;
      const cursor = newsCollection
        .find({ category: category })
        .sort({ pubDate: -1 })
        .limit(50);
      const result = await cursor.toArray();
      res.send(result);
    });

    // Get news by country
    app.get("/news/country/:country", async (req, res) => {
      const { country } = req.params;
      const cursor = newsCollection
        .find({ country: country })
        .sort({ pubDate: -1 })
        .limit(50);
      const result = await cursor.toArray();
      res.send(result);
    });

    // Get news by source
    app.get("/news/source/:sourceId", async (req, res) => {
      const { sourceId } = req.params;
      const cursor = newsCollection
        .find({ source_id: sourceId })
        .sort({ pubDate: -1 })
        .limit(50);
      const result = await cursor.toArray();
      res.send(result);
    });

    // Delete a news article
    app.delete("/news/:id", async (req, res) => {
      const { id } = req.params;
      const filter = { _id: new ObjectId(id) };
      const result = await newsCollection.deleteOne(filter);
      res.send(result);
    });

    app.get("/health", (req, res) => {
      res.send({ status: "OK", message: "Server is healthy" });
    });

    await client.db("admin").command({ ping: 1 });
    console.log(
      "Pinged your deployment. You successfully connected to MongoDB!",
    );
  } finally {
    // await client.close();
  }
}
run().catch(console.dir);

app.get("/", (req, res) => {
  res.send("News API Server is running.....");
});

app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});
