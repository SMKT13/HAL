package in.smkt.haldesk;

import java.net.URI;
import java.nio.charset.StandardCharsets;

final class ModelPolicy {
    static final long MIN_BYTES=1048576L,MAX_BYTES=1500000000L;
    static final long DOWNLOAD_BYTES=344671744L;
    static final String DOWNLOAD_SHA="03e7da1eb1108b50dffaa9bb52cc7bcbad2eb0c66ca990267f480c1e545d2856";
    static final String DOWNLOAD_URL="https://huggingface.co/litert-community/Qwen3-0.6B/resolve/e6687177e00897731e7716267eebd4eba0dde7c2/Qwen3-0.6B_dynamic_wi4b32_afp32.litertlm";
    static void size(long bytes)throws Exception {
        if(bytes<MIN_BYTES||bytes>MAX_BYTES)throw new Exception("Choose a LiteRT-LM model between 1 MB and 1.5 GB.");
    }
    static void header(byte[] bytes)throws Exception {
        if(bytes.length<8||!"LITERTLM".equals(new String(bytes,0,8,StandardCharsets.US_ASCII)))
            throw new Exception("This is not a LiteRT-LM model file. Choose a .litertlm model.");
    }
    static void downloadDestination(String target)throws Exception {
        URI uri=new URI(target);String host=uri.getHost();
        if(!"https".equals(uri.getScheme())||uri.getUserInfo()!=null||(uri.getPort()!=-1&&uri.getPort()!=443)||host==null||
                !(host.equals("huggingface.co")||host.endsWith(".huggingface.co")||host.endsWith(".hf.co")))
            throw new Exception("Model download redirected outside its trusted hosts.");
    }
    static String label(String value){
        if(value==null)return "Imported local model";
        String name=value.replaceAll("[\\p{Cntrl}/\\\\]","_");
        return name.substring(0,Math.min(name.length(),100));
    }
}
