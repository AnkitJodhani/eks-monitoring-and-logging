const express = require('express');
const morgan = require('morgan');
const pino = require('pino');
const promClient = require('prom-client');

const app = express();

const logger = pino();

const logging = () => {
    logger.info("here are the logs")
    logger.info("have a look ")
    logger.info("I know it is intentional")
}

app.use(morgan('common'))


// Prometheus metrics
const httpRequestCounter = new promClient.Counter({
    name: 'http_requests_total',
    help: 'Total number of HTTP requests',
    labelNames: ['method', 'path', 'status_code'],
});

const requestDurationHistogram = new promClient.Histogram({
    name: 'http_request_duration_seconds',
    help: 'Duration of HTTP requests in seconds',
    labelNames: ['method', 'path', 'status_code'],
    buckets: [0.1, 0.5, 1, 5, 10], // Buckets for the histogram in seconds
});

const requestDurationSummary = new promClient.Summary({
    name: 'http_request_duration_summary_seconds',
    help: 'Summary of the duration of HTTP requests in seconds',
    labelNames: ['method', 'path', 'status_code'],
    percentiles: [0.5, 0.9, 0.99], // Define your percentiles here
});



// Gauge metric
const gauge = new promClient.Gauge({
    name: 'node_gauge_example',
    help: 'Example of a gauge tracking async task duration',
    labelNames: ['method', 'status']
});

// Define an async function that simulates a task taking random time
const simulateAsyncTask = async () => {
    const randomTime = Math.random() * 5; // Random time between 0 and 5 seconds
    return new Promise((resolve) => setTimeout(resolve, randomTime * 1000));
};

app.disable('etag');

// Middleware to track metrics
app.use((req, res, next) => {
    const start = Date.now();
    res.on('finish', () => {
        const duration = (Date.now() - start) / 1000; // Duration in seconds
        const { method, url } = req;
        const statusCode = res.statusCode; // Get the actual HTTP status code
        httpRequestCounter.labels({ method, path: url, status_code: statusCode }).inc();
        requestDurationHistogram.labels({ method, path: url, status_code: statusCode }).observe(duration);
        requestDurationSummary.labels({ method, path: url, status_code: statusCode }).observe(duration);
    });
    next();
});

app.get('/', (req, res) => {
    res.status(200).json({
        status: "Running"
    });
});

app.get('/healty', (req, res) => {
    res.status(200).json({
        name: "Ankit",
        status: "healthy"
    })
});

app.get('/serverError', (req, res) => {
    res.status(500).json({
        error: " Internal server error",
        statusCode: 500
    })
});

app.get('/notFound', (req, res) => {
    res.status(404).json({
        error: "Not Found",
        statusCode: "404"
    })
});

app.get('/logs', (req, res) => {
    logging();
    res.status(200).json({
        objective: "To generate logs"
    })
});


// Simulate a crash by throwing an error
app.get('/crash', (req, res) => {
    console.log('Intentionally crashing the server...');
    process.exit(1);
});


// Define the /example route
app.get('/example', async (req, res) => {
    const endGauge = gauge.startTimer({ method: req.method, status: res.statusCode });
    await simulateAsyncTask();
    endGauge();
    res.send('Async task completed');
});

// Expose metrics for Prometheus to scrape
app.get('/metrics', async (req, res) => {
    res.set('Content-Type', promClient.register.contentType);
    res.end(await promClient.register.metrics());
});


const PORT = 3000;
app.listen(PORT, () => {
    console.log(`listening on port ${PORT}`)
})

