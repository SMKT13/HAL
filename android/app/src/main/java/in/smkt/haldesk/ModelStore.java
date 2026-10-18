package in.smkt.haldesk;

import java.io.*;
import java.nio.file.Files;
import java.nio.file.StandardCopyOption;
import java.security.MessageDigest;
import java.util.Properties;
import java.util.concurrent.atomic.AtomicBoolean;

/** Stream and atomically commit weights; a failed transfer keeps the previous model. */
final class ModelStore {
    interface Progress {void update(long bytes,long total);}
    private final File directory,model,metadata;
    ModelStore(File files)throws Exception {
        directory=new File(files,"local-ai");
        if(!directory.isDirectory()&&!directory.mkdirs())throw new IOException("Could not create local model storage.");
        model=new File(directory,"model.litertlm");metadata=new File(directory,"model.properties");
    }
    File file(){return model;}
    boolean ready(){return model.isFile()&&model.length()>=ModelPolicy.MIN_BYTES;}
    String label(){
        try(InputStream input=new FileInputStream(metadata)){Properties p=new Properties();p.load(input);return ModelPolicy.label(p.getProperty("label"));}
        catch(Exception ignored){return "Imported local model";}
    }
    void remove()throws Exception {
        if(model.exists()&&!model.delete())throw new IOException("Could not remove the AI model.");
        Files.deleteIfExists(new File(directory,"model.part").toPath());
        Files.deleteIfExists(metadata.toPath());
    }
    void install(InputStream source,String label,long expectedSize,String expectedHash,AtomicBoolean cancelled,Progress progress)throws Exception {
        if(expectedSize>0)ModelPolicy.size(expectedSize);
        File partial=new File(directory,"model.part");Files.deleteIfExists(partial.toPath());
        long needed=(expectedSize>0?expectedSize:ModelPolicy.MIN_BYTES)+200000000L;
        if(directory.getUsableSpace()<needed)throw new IOException("Free more storage before importing this model.");
        try {
            MessageDigest digest=MessageDigest.getInstance("SHA-256");long total=0,lastUpdate=0;byte[] header=new byte[8];int headerSize=0;
            try(OutputStream output=new FileOutputStream(partial)){
                byte[] buffer=new byte[65536];int count;
                while((count=source.read(buffer))!=-1){
                    if(cancelled.get()||Thread.currentThread().isInterrupted())throw new InterruptedIOException("Model transfer cancelled.");
                    total+=count;if(total>ModelPolicy.MAX_BYTES)throw new IOException("The model exceeds the 1.5 GB import limit.");
                    if(headerSize<8){int n=Math.min(8-headerSize,count);System.arraycopy(buffer,0,header,headerSize,n);headerSize+=n;if(headerSize==8)ModelPolicy.header(header);}
                    digest.update(buffer,0,count);output.write(buffer,0,count);
                    if(System.currentTimeMillis()-lastUpdate>1000){if(directory.getUsableSpace()<200000000L)throw new IOException("Free more storage before importing this model.");progress.update(total,expectedSize);lastUpdate=System.currentTimeMillis();}
                }
            }
            ModelPolicy.size(total);ModelPolicy.header(header);
            if(cancelled.get())throw new InterruptedIOException("Model transfer cancelled.");
            if(expectedSize>0&&total!=expectedSize)throw new IOException("Model download was incomplete. The previous model is retained.");
            StringBuilder hash=new StringBuilder();for(byte b:digest.digest())hash.append(String.format("%02x",b&255));
            if(expectedHash!=null&&!expectedHash.equals(hash.toString()))throw new IOException("Model checksum failed. The previous model is retained.");
            Files.move(partial.toPath(),model.toPath(),StandardCopyOption.ATOMIC_MOVE,StandardCopyOption.REPLACE_EXISTING);
            Properties p=new Properties();p.setProperty("label",ModelPolicy.label(label));p.setProperty("sha256",hash.toString());
            try(OutputStream output=new FileOutputStream(metadata)){p.store(output,"Local AI model");}
            catch(IOException error){Files.deleteIfExists(metadata.toPath());}
            progress.update(total,total);
        } finally {Files.deleteIfExists(partial.toPath());}
    }
}
