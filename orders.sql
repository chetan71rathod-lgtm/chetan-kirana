-- Apply after setup.sql. Customer order creation is validated in this database function.
create or replace function public.create_customer_order(
 p_customer_name text,p_mobile text,p_address text,p_note text,p_payment_method text,p_items jsonb
) returns uuid language plpgsql security definer set search_path=public as $$
declare v_order uuid; v_subtotal numeric(10,2):=0; v_delivery numeric(10,2); v_item jsonb;
 v_product public.products%rowtype; v_qty integer;
begin
 if length(trim(coalesce(p_customer_name,'')))<2 or p_mobile !~ '^[6-9][0-9]{9}$'
 or length(p_mobile)<>10 or length(trim(coalesce(p_address,'')))<8 then raise exception 'Enter valid name, mobile and address'; end if;
 if p_payment_method not in ('COD','UPI') then raise exception 'Invalid payment method'; end if;
 if jsonb_typeof(p_items)<>'array' or jsonb_array_length(p_items)=0 then raise exception 'Cart is empty'; end if;
 for v_item in select * from jsonb_array_elements(p_items) loop
  v_qty:=(v_item->>'quantity')::integer;
  if v_qty<1 or v_qty>99 then raise exception 'Invalid quantity'; end if;
  select * into v_product from public.products where id=(v_item->>'product_id')::uuid and is_active=true for update;
  if not found then raise exception 'Product unavailable'; end if;
  if v_product.stock is not null and v_product.stock<v_qty then raise exception 'Insufficient stock'; end if;
  v_subtotal:=v_subtotal+v_product.price*v_qty;
 end loop;
 v_delivery:=case when v_subtotal>=500 then 0 else 20 end;
 insert into public.orders(customer_name,mobile,address,note,payment_method,subtotal,delivery_fee,total)
 values(trim(p_customer_name),p_mobile,trim(p_address),p_note,p_payment_method,v_subtotal,v_delivery,v_subtotal+v_delivery) returning id into v_order;
 for v_item in select * from jsonb_array_elements(p_items) loop
  v_qty:=(v_item->>'quantity')::integer;
  select * into v_product from public.products where id=(v_item->>'product_id')::uuid and is_active=true for update;
  insert into public.order_items(order_id,product_id,product_name,unit_price,quantity,line_total)
  values(v_order,v_product.id,v_product.name,v_product.price,v_qty,v_product.price*v_qty);
  if v_product.stock is not null then update public.products set stock=stock-v_qty where id=v_product.id; end if;
 end loop;
 return v_order;
end; $$;
revoke all on function public.create_customer_order(text,text,text,text,text,jsonb) from public;
grant execute on function public.create_customer_order(text,text,text,text,text,jsonb) to anon,authenticated;
