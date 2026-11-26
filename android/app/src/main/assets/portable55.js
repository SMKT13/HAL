/* Portable v1 protects the schema-validated saved book. No secret or chat stores are inputs. */
(function(root){
 'use strict';
 const format='HAL Atlas encrypted book', iterations=600000;
 function encode(bytes){
  let text='';
  for(let i=0;i<bytes.length;i+=8192)text+=String.fromCharCode(...bytes.subarray(i,i+8192));
  return btoa(text);
 }
 const decode=text=>Uint8Array.from(atob(text),c=>c.charCodeAt(0));
 async function derive(password,salt){
  const material=await crypto.subtle.importKey('raw',new TextEncoder().encode(password),'PBKDF2',false,['deriveKey']);
  return crypto.subtle.deriveKey({name:'PBKDF2',hash:'SHA-256',salt,iterations},material,{name:'AES-GCM',length:256},false,['encrypt','decrypt']);
 }
 async function seal(book,password){
  if(!password||password.length<10)throw Error('Use at least ten characters.');
  const salt=crypto.getRandomValues(new Uint8Array(16)),iv=crypto.getRandomValues(new Uint8Array(12));
  const bytes=new TextEncoder().encode(JSON.stringify(book));
  const encrypted=await crypto.subtle.encrypt({name:'AES-GCM',iv},await derive(password,salt),bytes);
  const envelope={format,version:1,salt:encode(salt),iv:encode(iv),ciphertext:encode(new Uint8Array(encrypted))};
  if(JSON.stringify(envelope).length>2000000)throw Error('Encrypted book exceeds the file picker limit.');
  return envelope;
 }
 async function unlock(envelope,password){
  if(envelope.format!==format||envelope.version!==1||typeof envelope.ciphertext!=='string'||envelope.ciphertext.length>2000000)throw Error('Unsupported backup.');
  const salt=decode(envelope.salt),iv=decode(envelope.iv);
  if(salt.length!==16||iv.length!==12)throw Error('Invalid backup header.');
  const data=await crypto.subtle.decrypt({name:'AES-GCM',iv},await derive(password,salt),decode(envelope.ciphertext));
  return JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(data));
 }
 const api={format,seal,unlock};
 if(typeof module==='object'&&module.exports)module.exports=api;
 else root.HALPortable=api;
})(typeof window==='object'?window:globalThis);
