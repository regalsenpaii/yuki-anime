<?php
/**
 * Yuki Anime Proxy & Scraper
 * Folder: api/
 */

// CORS Headers
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization');
header('Content-Type: text/html; charset=utf-8');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

// Validate URL
if (!isset($_GET['url'])) {
    http_response_code(400);
    echo json_encode(['error' => 'Parameter url diperlukan']);
    exit;
}

$url = $_GET['url'];

// Whitelist domains
$allowedHosts = [
    's13.nontonanimeid.boats',
    'nontonanimeid.boats',
    'nontonanimeid.my.id',
    'i0.wp.com',
    'i1.wp.com',
    'i2.wp.com',
    'i3.wp.com',
    'cdn.myanimelist.net',
    'cdn.noimage',
    'blogger.googleusercontent.com'
];

$parsed = parse_url($url);
$host = $parsed['host'] ?? '';

$isAllowed = false;
foreach ($allowedHosts as $allowed) {
    if (strpos($host, $allowed) !== false) {
        $isAllowed = true;
        break;
    }
}

if (!$isAllowed) {
    http_response_code(403);
    echo json_encode(['error' => 'Domain tidak diizinkan: ' . $host]);
    exit;
}

// cURL fetch
$ch = curl_init();
curl_setopt_array($ch, [
    CURLOPT_URL => $url,
    CURLOPT_RETURNTRANSFER => true,
    CURLOPT_FOLLOWLOCATION => true,
    CURLOPT_MAXREDIRS => 5,
    CURLOPT_TIMEOUT => 30,
    CURLOPT_SSL_VERIFYPEER => false,
    CURLOPT_SSL_VERIFYHOST => 0,
    CURLOPT_USERAGENT => 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    CURLOPT_HTTPHEADER => [
        'Accept: text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language: id-ID,id;q=0.9,en-US;q=0.8,en;q=0.7',
        'Accept-Encoding: gzip, deflate, br',
        'Referer: https://s13.nontonanimeid.boats/',
        'Connection: keep-alive',
        'Upgrade-Insecure-Requests: 1'
    ],
    CURLOPT_ENCODING => ''
]);

$response = curl_exec($ch);
$httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
$error = curl_error($ch);
curl_close($ch);

if ($error) {
    http_response_code(500);
    echo json_encode(['error' => 'cURL Error: ' . $error]);
    exit;
}

if ($httpCode !== 200) {
    http_response_code($httpCode);
    echo json_encode(['error' => 'HTTP Error: ' . $httpCode]);
    exit;
}

// Decompress if gzip
if (strpos($response, "\x1f\x8b") === 0) {
    $decompressed = @gzdecode($response);
    if ($decompressed !== false) {
        $response = $decompressed;
    }
}

// Clean dangerous scripts (basic XSS protection)
$response = preg_replace('/<script\b[^>]*>(.*?)<\/script>/is', '', $response);
$response = preg_replace('/<iframe[^>]*src=["\'][^"\']*(?:ads|popup|click)[^"\']*["\'][^>]*>/i', '', $response);
$response = preg_replace('/on\w+\s*=\s*["\'][^"\']*["\']/i', '', $response);

echo $response;
?>
