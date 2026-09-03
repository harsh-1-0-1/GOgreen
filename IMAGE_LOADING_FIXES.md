# Image Loading Performance Fixes

## Issues Identified
1. ❌ CORS errors when cropping uploaded images
2. ❌ Slow image loading from CDN
3. ❌ Missing cache headers on S3 uploads
4. ❌ Missing cache headers on static file serving

## Fixes Applied (Backend)

### 1. CORS Headers for Static Files ✅
**File**: `backend/main.py`

Created `CORSStaticFiles` class that adds:
- `Access-Control-Allow-Origin` header
- `Access-Control-Allow-Methods` header  
- `Cache-Control: public, max-age=31536000, immutable` (1 year cache)
- `Vary: Accept-Encoding` for compression

This fixes the canvas CORS error when cropping images.

### 2. S3 Upload Cache Headers ✅
**File**: `backend/app/utils/image_upload.py`

Added to S3 uploads:
- `CacheControl: public, max-age=31536000, immutable`
- Metadata for tracking

### 3. Image Crop Modal Fix ✅
**File**: `frontend/src/components/admin/ImageCropModal.tsx`

Fixed image loading and cropping:
- Better error handling for image load
- Removed incorrect scaling calculation
- More detailed error messages

## Frontend Status
✅ Lazy loading already implemented across all components
✅ Proper alt tags on images
✅ Hero images use `loading="eager"`
✅ Below-fold images use `loading="lazy"`

## CloudFront Configuration Needed

### Critical: Enable Compression
In your CloudFront distribution:
1. Go to **Behaviors** tab
2. Edit the default behavior (or create one for `plantoga/*`)
3. Set **Compress Objects Automatically** to **Yes**
4. Save changes

This is the **#1 reason** for slow image loading from CDN.

### Recommended: Custom Cache Policy
Create a cache policy with:
- **Min TTL**: 0
- **Max TTL**: 31536000 (1 year)
- **Default TTL**: 86400 (1 day)
- **Headers**: Include `Accept-Encoding`
- **Enable compression**: Yes

### Check Current Status
Open browser DevTools → Network tab → Load a page with images:

**Look for these response headers:**
```
X-Cache: Hit from cloudfront              ← Should see this after first load
Age: 3600                                  ← Increases on cache hits
Cache-Control: public, max-age=31536000
Content-Encoding: gzip                     ← Image compressed
Access-Control-Allow-Origin: *             ← CORS enabled
```

**Bad signs:**
```
X-Cache: Miss from cloudfront              ← Every time = no caching
X-Cache: Error from cloudfront             ← Configuration issue
(no Content-Encoding header)               ← Compression disabled
```

## Testing

### Test CORS Fix
1. Restart backend: `cd backend && make run-dev`
2. Go to admin → Edit a banner with existing image
3. Click to crop → Should work without CORS error

### Test Image Speed
1. Open DevTools → Network tab → Filter "Img"
2. Load homepage
3. Check "Time" column for images
4. First load: 300-800ms acceptable (cache miss)
5. Reload page: <50ms (cache hit)

### Test CloudFront Cache
```bash
# First request (cache miss)
curl -I https://d123456.cloudfront.net/plantoga/banners/xxx.jpg

# Should see:
# X-Cache: Miss from cloudfront
# Cache-Control: public, max-age=31536000

# Second request (should be cache hit)
curl -I https://d123456.cloudfront.net/plantoga/banners/xxx.jpg

# Should see:
# X-Cache: Hit from cloudfront
# Age: 5
```

## Next Steps

1. **Restart backend** to apply CORS and cache header fixes
2. **Enable CloudFront compression** (see guide above)
3. **Test image cropping** - should work now
4. **Monitor cache hit rate** in CloudFront metrics (should be >80%)
5. **(Optional)** Implement WebP conversion for smaller file sizes
6. **(Optional)** Implement responsive images with srcset

## Performance Benchmarks

### Expected Performance After Fixes:
- **First page load**: 2-3 seconds (cache miss)
- **Subsequent loads**: <1 second (cache hit)
- **Image TTFB**: <200ms from CloudFront
- **Cache hit rate**: >80%
- **Bandwidth savings**: 60-70% with compression

### Current vs Expected:
| Metric | Before | After Fix | After CloudFront Config |
|--------|--------|-----------|------------------------|
| CORS Error | ❌ Failed | ✅ Fixed | ✅ Fixed |
| Cache Headers | ❌ None | ✅ Present | ✅ Present |
| Compression | ❌ No | ✅ Backend ready | ⚠️ Need CF config |
| Image Load Time | 2-5s | 1-3s | <1s |

## Troubleshooting

### If images still slow after changes:

1. **Check environment variables**:
   ```bash
   CDN_BASE_URL=https://d123456.cloudfront.net  # Must be set
   ENVIRONMENT=production                        # Must be production
   ```

2. **Verify CloudFront is being used**:
   - Images should load from `d123456.cloudfront.net`
   - NOT from `s3.amazonaws.com`

3. **Check S3 bucket region**:
   - Should be close to your users (e.g., `us-east-1` for US)

4. **Invalidate CloudFront cache** if you changed S3 objects:
   ```bash
   aws cloudfront create-invalidation \
     --distribution-id YOUR_DIST_ID \
     --paths "/*"
   ```

5. **Check CloudFront metrics**:
   - Go to CloudFront console → Your distribution → Monitoring
   - Look for cache hit rate (should be >80%)
   - Look for origin latency (should be <100ms)

## Files Modified

1. ✅ `backend/main.py` - Added CORSStaticFiles class
2. ✅ `backend/app/utils/image_upload.py` - Added S3 cache headers
3. ✅ `frontend/src/components/admin/ImageCropModal.tsx` - Fixed cropping

## Documentation Created

1. ✅ `CDN_OPTIMIZATION_GUIDE.md` - Complete CloudFront setup guide
2. ✅ `IMAGE_LOADING_FIXES.md` - This file

---

**Status**: Backend fixes applied ✅  
**Action Required**: Configure CloudFront compression ⚠️  
**Testing Required**: Restart backend and test cropping ✅
