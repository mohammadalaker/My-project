const { createClient } = require('@supabase/supabase-js');
const path = require('path');
const fs = require('fs');

function loadEnv() {
  const envPaths = [
    path.join(__dirname, '..', '.env'),
    path.join(__dirname, '..', '..', '.env'),
  ];
  for (const envPath of envPaths) {
    if (!fs.existsSync(envPath)) continue;
    const content = fs.readFileSync(envPath, 'utf8');
    content.split(/\r?\n/).forEach((line) => {
      const m = line.match(/^\s*([^#=]+)=(.*)$/);
      if (m) {
        const key = m[1].trim();
        let val = m[2].trim();
        if (val.startsWith('"') && val.endsWith('"')) val = val.slice(1, -1);
        process.env[key] = val;
      }
    });
    return true;
  }
}

async function hideInvalid() {
  loadEnv();
  const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);
  
  const { data, error } = await supabase.from('items').select('barcode, image_url, visible, stock_count');
  
  const invalidVisible = data.filter(d => 
    d.visible && 
    (!d.image_url || !d.image_url.startsWith('http')) &&
    (d.stock_count === 0 || d.stock_count === null)
  );
  
  console.log(`Hiding ${invalidVisible.length} invalid items...`);
  
  let successCount = 0;
  for (const item of invalidVisible) {
    const { error: updateError } = await supabase
      .from('items')
      .update({ visible: false })
      .eq('barcode', item.barcode);
      
    if (updateError) {
      console.error(`Error updating barcode ${item.barcode}:`, updateError);
    } else {
      successCount++;
    }
  }
  
  console.log(`Successfully hidden ${successCount} items.`);
}

hideInvalid();
