# CDN Image Loading Optimization Guide

## Current Issues
Images are loading slowly from the CDN. This could be due to several reasons:

## 1. CloudFront Distribution Settings

### Cache Behavior Settings (CRITICAL)
Your CloudFront distribution should have these settings:

**Path Pattern**: `plantoga/*` (or `*` for all content)

**Cache Key and Origin Requests**:
- **Cache Policy**: Create a custom cache policy or use "CachingOptimized"
- **Headers**: Include `Accept-Encoding` for compression
- **Query strings**: None (unless you need them)
- **Cookies**: None

**TTL Settings**:
- **Minimum TTL**: 0
- **Maximum TTL**: 31536000 (1 year)
- **Default TTL**: 86400 (1 day)

**Compress Objects Automatically**: ✅ **ENABLED** (Most Important!)

**Response Headers Policy**:
Create a custom policy with these headers:
```
Access-Control-Allow-Origin: *
Access-Control-Allow-Methods: GET, OPTIONS
Cache-Control: public, max-age=31536000, immutable
```

### Origin Settings
**Origin Domain**: Your S3 bucket domain (e.g., `plantoga-images.s3.us-east-1.amazonaws.com`)
**Origin Access**: Use Origin Access Control (OAC) - recommended over OAI

### Price Class
- **Use All Edge Locations** (best performance but higher cost)
- OR **Use Only North America and Europe** (balance cost and performance)

### Viewer Protocol Policy
- **Redirect HTTP to HTTPS** or **HTTPS Only**

## 2. S3 Bucket Configuration

### Bucket Policy (if using CloudFront OAC)
```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "AllowCloudFrontServicePrincipal",
      "Effect": "Allow",
      "Principal": {
        "Service": "cloudfront.amazonaws.com"
      },
      "Action": "s3:GetObject",
      "Resource": "arn:aws:s3:::YOUR-BUCKET-NAME/*",
      "Condition": {
        "StringEquals": {
          "AWS:SourceArn": "arn:aws:cloudfront::YOUR-ACCOUNT-ID:distribution/YOUR-DISTRIBUTION-ID"
        }
      }
    }
  ]
}
```

### CORS Configuration
```json
[
  {
    "AllowedHeaders": ["*"],
    "AllowedMethods": ["GET", "HEAD"],
    "AllowedOrigins": ["*"],
    "ExposeHeaders": ["ETag"],
    "MaxAgeSeconds": 3600
  }
]
```

## 3. Backend Code Changes (Already Applied)

✅ Added `CacheControl` headers to S3 uploads
✅ Added CORS headers to static file serving
✅ Added cache headers to local static files

## 4. Frontend Optimization

### Add these to your image components:

```tsx
// For product images
<img
  src={imageUrl}
  alt={productName}
  loading="lazy"
  decoding="async"
  fetchpriority="low"  // or "high" for hero images
/>

// For critical images (hero, above the fold)
<img
  src={imageUrl}
  alt={heroTitle}
  loading="eager"
  decoding="async"
  fetchpriority="high"
/>
```

### Use responsive images with srcset:
```tsx
<img
  src={imageUrl}
  srcSet={`${thumbnailUrl} 400w, ${mediumUrl} 800w, ${largeUrl} 1200w`}
  sizes="(max-width: 640px) 400px, (max-width: 1024px) 800px, 1200px"
  alt={productName}
/>
```

## 5. Check CloudFront Cache Status

Add this to your browser DevTools Network tab:
- Look at response headers for images
- Check for `X-Cache: Hit from cloudfront` (good) vs `X-Cache: Miss from cloudfront` (first load)
- Check `Age` header - should increase on subsequent loads
- Check `Cache-Control` header

## 6. Invalidate CloudFront Cache (If Needed)

```bash
aws cloudfront create-invalidation \
  --distribution-id YOUR_DISTRIBUTION_ID \
  --paths "/*"
```

## 7. Monitor Performance

Use CloudWatch to monitor:
- **Origin Latency**: Should be < 100ms
- **Cache Hit Rate**: Should be > 80%
- **4xx and 5xx Error Rates**: Should be near 0%

## 8. Quick Wins

### Immediate Actions:
1. ✅ Enable "Compress Objects Automatically" in CloudFront
2. ✅ Set proper Cache-Control headers (already done in code)
3. ✅ Add CORS headers (already done in code)
4. Verify CloudFront distribution is using HTTP/2 and HTTP/3 (QUIC)
5. Enable CloudFront logging to debug slow requests

### Medium-term:
1. Implement image resizing/optimization (use S3 + Lambda@Edge or ImageKit)
2. Convert images to WebP format for better compression
3. Implement lazy loading for all images (already done in most places)
4. Use a CDN-aware image optimization service

## 9. Troubleshooting Slow Loads

### If images are still slow:

1. **Check Network Tab**:
   - How long is "Waiting (TTFB)"? (Should be < 200ms for CDN)
   - How long is "Content Download"? (Depends on file size)
   - Is the request going to CloudFront or directly to S3?

2. **Verify CDN URL**:
   - Should be: `https://d123456.cloudfront.net/plantoga/...`
   - Not: `https://s3.amazonaws.com/bucket/...`

3. **Check S3 Region**:
   - Is your S3 bucket in the same region as most users?
   - Consider using Transfer Acceleration

4. **Test from Different Locations**:
   - Use tools like GTmetrix, WebPageTest, or Pingdom
   - Test from different geographic locations

## 10. Environment Variables to Check

Make sure these are set correctly in production:

```bash
CDN_BASE_URL=https://d123456.cloudfront.net
AWS_S3_BUCKET=plantoga-images
AWS_REGION=us-east-1  # or your preferred region
ENVIRONMENT=production
```

## Notes

- The backend code has been updated to add proper cache headers
- CloudFront compression must be enabled at the distribution level
- First load will always be slower (cache miss)
- Subsequent loads should be much faster (cache hit)
- Images with UUID filenames can be cached indefinitely (immutable)
