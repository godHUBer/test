import test from 'node:test';
import assert from 'node:assert/strict';
import sharp from 'sharp';
import {safeAuditChanges} from '../../lib/admin/audit';
import {parseFields,version,identity,mediaIds,statusChange} from '../../lib/admin/validation';
import {sanitiseImage,MAX_IMAGE_BYTES} from '../../lib/admin/images';
function form(overrides:Record<string,string>={}){const result=new FormData();for(const [k,v] of Object.entries({id:'new-car',version:'0',year:'2020',make:'Test',model:'Model',variant:'Base',km:'12000',fuel:'Petrol',transmission:'',body:'SUV',price_lakh:'8.55555',price_note:'',reg:'Test region',location:'Test',highlights:'First\nSecond',overview:'<script>plain text</script>',listing_url:'',sort_order:'100',...overrides}))result.set(k,v);return result;}
test('staff edit parser preserves exact prices, null unknowns and plain text without trusting extra fields',()=>{
 const f=parseFields(form());assert.equal(f.price_lakh,'8.55555');assert.equal(f.transmission,null);assert.equal(f.overview,'<script>plain text</script>');assert.deepEqual(f.highlights,['First','Second']);assert.equal(version(form(),true),0);assert.equal(identity(form()),'new-car');
 for(const values of [{price_lakh:'8.555555'},{price_lakh:'-1'},{year:'9999'},{km:'1.5'},{make:''},{listing_url:'javascript:alert(1)'},{listing_url:'https://secret:password@example.test/'},{highlights:'line\n'.repeat(13)}] as Record<string,string>[])assert.throws(()=>parseFields(form(values)));
 assert.throws(()=>version(form()));assert.throws(()=>identity(form({id:'../bad'})));assert.throws(()=>mediaIds(form({asset_ids:'fake'})));assert.throws(()=>statusChange(form({next_status:'sold',reason:'x'})));
});
test('image processor decodes formats and strips metadata while bounding pixels and output',async()=>{
 const original=await sharp({create:{width:800,height:600,channels:3,background:'#336655'}}).jpeg().withMetadata({exif:{IFD0:{Artist:'Private uploader',ImageDescription:'Sensitive original metadata'}}}).toBuffer();
 assert.ok((await sharp(original).metadata()).exif);
 const result=await sanitiseImage(original),metadata=await sharp(result.data).metadata();
 assert.equal(metadata.format,'webp');assert.equal(metadata.exif,undefined);assert.equal(metadata.icc,undefined);assert.equal(result.width,800);assert.equal(result.height,600);assert.ok(result.data.length<MAX_IMAGE_BYTES);
 const png=await sharp({create:{width:400,height:300,channels:4,background:'#336655'}}).png().toBuffer();assert.equal((await sharp((await sanitiseImage(png)).data).metadata()).format,'webp');
 const svg=Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="800" height="600"><rect width="800" height="600" fill="red"/></svg>');
 await assert.rejects(sanitiseImage(svg));await assert.rejects(sanitiseImage(Buffer.from('<html>not an image</html>')));await assert.rejects(sanitiseImage(Buffer.alloc(MAX_IMAGE_BYTES+1)));
 const small=await sharp({create:{width:100,height:100,channels:3,background:'red'}}).png().toBuffer();await assert.rejects(sanitiseImage(small));
 const huge=await sharp({create:{width:6000,height:5000,channels:3,background:'red'}}).png().toBuffer();await assert.rejects(sanitiseImage(huge));
});

test('historical audit display strips raw notes, identities and media URLs',()=>{
 const safe=safeAuditChanges({price_lakh:{from:1,to:2},overview:{from:'private legacy text',to:'private'},email:'private@example.test',photo_stock:'https://private.example.test/secret',state:'published'});
 assert.deepEqual(safe,{price_lakh:{from:1,to:2},state:'published'});
});
