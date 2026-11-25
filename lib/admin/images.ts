import sharp from 'sharp';
export const MAX_IMAGE_BYTES=5*1024*1024;
/** Never trust filename, extension or browser Content-Type. Decode, orient and re-encode without metadata. */
export async function sanitiseImage(bytes:Buffer){
  if(!bytes.length||bytes.length>MAX_IMAGE_BYTES)throw new Error('Choose an image no larger than 5 MiB');
  const metadata=await sharp(bytes,{limitInputPixels:24000000,failOn:'warning'}).metadata();
  if(!['jpeg','png','webp'].includes(metadata.format??'')||(metadata.pages??1)>1)throw new Error('Only still JPEG, PNG and WebP photographs are accepted');
  if(!metadata.width||!metadata.height||metadata.width<320||metadata.height<240)throw new Error('Photograph must be at least 320 × 240 pixels');
  const result=await sharp(bytes,{limitInputPixels:24000000,failOn:'warning'}).rotate().resize({width:2400,height:2400,fit:'inside',withoutEnlargement:true}).webp({quality:84,effort:4}).toBuffer({resolveWithObject:true});
  if(result.data.length>MAX_IMAGE_BYTES||result.info.width<320||result.info.height<240)throw new Error('Processed photograph is outside supported bounds');
  return {data:result.data,width:result.info.width,height:result.info.height};
}
