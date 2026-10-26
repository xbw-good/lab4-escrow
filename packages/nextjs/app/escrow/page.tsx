"use client";
import { useState, useMemo } from "react";
import { useAccount } from "wagmi";
import { formatUnits } from "viem";
import {
  useScaffoldReadContract,
  useScaffoldWriteContract,
} from "~~/hooks/scaffold-eth";
import { Address } from "~~/components/scaffold-eth";

const STATUS_MAP: Record<number, { text: string; color: string }> = {
  0: { text: "Created 待付款", color: "badge-ghost" },
  1: { text: "Paid 已付款", color: "badge-info" },
  2: { text: "Completed 已完成", color: "badge-success" },
  3: { text: "Refunded 已退款", color: "badge-warning" },
  4: { text: "Disputed 争议中", color: "badge-error" },
};

export default function EscrowPage() {
  const { address } = useAccount();

  // 1. 读取基础数据
  const { data: arbiter } = useScaffoldReadContract({
    contractName: "Escrow",
    functionName: "arbiter",
  });

  const { data: orderCount } = useScaffoldReadContract({
    contractName: "Escrow",
    functionName: "orderCount",
  });

  const { writeContractAsync: writeEscrow } = useScaffoldWriteContract({ contractName: "Escrow" });
  const { writeContractAsync: writeToken } = useScaffoldWriteContract({ contractName: "XBWToken" });

  // 生成订单 ID 列表
  const orderIds = orderCount ? Array.from({ length: Number(orderCount) }, (_, i) => BigInt(i)) : [];

  // 判断当前角色
  const isArbiter = address?.toLowerCase() === arbiter?.toLowerCase();
  const role = isArbiter ? "仲裁人" : "用户";

  return (
    <div className="flex flex-col items-center pt-10 px-4 pb-20">
      <div className="w-full max-w-5xl space-y-6">
        
        {/* 顶部状态栏 */}
        <div className="bg-base-100 shadow-sm rounded-xl p-4 flex flex-wrap items-center justify-between gap-4 border border-base-300">
          <h2 className="text-xl font-bold">托管交易</h2>
          <div className="flex items-center gap-6 text-sm">
            <div className="flex items-center gap-2">
              <span className="text-gray-500">当前账户:</span>
              {address ? <Address address={address} size="sm" /> : "未连接"}
            </div>
            <div className="flex items-center gap-2">
              <span className="text-gray-500">仲裁人:</span>
              {arbiter ? <Address address={arbiter} size="sm" /> : "读取中..."}
            </div>
            <div className="flex items-center gap-2">
              <span className="text-gray-500">你的角色:</span>
              <span className="bg-primary/10 text-primary px-3 py-1 rounded-full font-medium">{role}</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-gray-500">订单总数:</span>
              <span className="font-bold">{orderCount?.toString() || 0}</span>
            </div>
          </div>
        </div>

        {/* 创建订单卡片 */}
        <CreateOrderForm writeEscrow={writeEscrow} />

        {/* 订单列表卡片 */}
        <div className="bg-base-100 shadow-sm rounded-xl p-6 border border-base-300">
          <h3 className="text-lg font-bold mb-4">订单列表</h3>
          <div className="overflow-x-auto">
            <table className="table w-full">
              <thead>
                <tr className="text-gray-500">
                  <th>#</th>
                  <th>买家</th>
                  <th>卖家</th>
                  <th>金额</th>
                  <th>截止</th>
                  <th>描述</th>
                  <th>状态</th>
                  <th>操作</th>
                </tr>
              </thead>
              <tbody>
                {orderIds.length === 0 ? (
                  <tr><td colSpan={8} className="text-center py-8 text-gray-400">暂无订单数据</td></tr>
                ) : (
                  orderIds.map((id) => (
                    <OrderRow 
                      key={id.toString()} 
                      id={id} 
                      currentAddress={address} 
                      arbiter={arbiter}
                      writeEscrow={writeEscrow}
                      writeToken={writeToken}
                    />
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

      </div>
    </div>
  );
}

// ================= 子组件：创建订单表单 =================
function CreateOrderForm({ writeEscrow }: any) {
  const [seller, setSeller] = useState("");
  const [amount, setAmount] = useState("");
  const [minutes, setMinutes] = useState("");
  const [description, setDescription] = useState("");
  const [loading, setLoading] = useState(false);

  const handleCreate = async () => {
    try {
      setLoading(true);
      // ⚠️ 必须替换成你真实的代币合约地址
      const tokenAddress = "0x81330bbb686FFaf83cf4472273BE3915ec5A1d1b"; 
      const amountWei = parseUnits(amount, 18);
      const deadline = Math.floor(Date.now() / 1000) + Number(minutes) * 60;

      await writeEscrow({
        functionName: "createOrder",
        args: [seller, tokenAddress, amountWei, BigInt(deadline), description],
      });
      
      // 清空表单
      setSeller(""); setAmount(""); setMinutes(""); setDescription("");
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-base-100 shadow-sm rounded-xl p-6 border border-base-300">
      <h3 className="text-lg font-bold mb-4">创建订单</h3>
      <div className="flex flex-col gap-3">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <input className="input input-bordered w-full text-sm" placeholder="卖家地址 (0x...)" value={seller} onChange={(e) => setSeller(e.target.value)} />
          <input className="input input-bordered w-full text-sm" placeholder="金额" type="number" value={amount} onChange={(e) => setAmount(e.target.value)} />
          <input className="input input-bordered w-full text-sm" placeholder="多少分钟后到期" type="number" value={minutes} onChange={(e) => setMinutes(e.target.value)} />
        </div>
        <div className="flex gap-3">
          <input className="input input-bordered flex-1 text-sm" placeholder="描述" value={description} onChange={(e) => setDescription(e.target.value)} />
          <button className={`btn btn-primary ${loading ? "loading" : ""}`} onClick={handleCreate} disabled={loading}>
            创建订单
          </button>
        </div>
        <p className="text-xs text-gray-400 mt-1">
          代币: 0x81330bbb686FFaf83cf4472273BE3915ec5A1d1b，金额按 18 位精度换算，截止时间按当前时间加分钟数换算成时间戳。
        </p>
      </div>
    </div>
  );
}

// ================= 子组件：订单行 =================
function OrderRow({ id, currentAddress, arbiter, writeEscrow, writeToken }: any) {
  const { data: order, refetch } = useScaffoldReadContract({
    contractName: "Escrow",
    functionName: "getOrder",
    args: [id],
  });

  if (!order) return <tr><td colSpan={8} className="text-center animate-pulse">读取中...</td></tr>;

  const isBuyer = currentAddress?.toLowerCase() === order.buyer.toLowerCase();
  const isSeller = currentAddress?.toLowerCase() === order.seller.toLowerCase();
  const isArbiter = currentAddress?.toLowerCase() === arbiter?.toLowerCase();
  
  const statusInfo = STATUS_MAP[Number(order.status)] || { text: "未知", color: "" };

  // 格式化时间
  const formatDate = (timestamp: bigint) => {
    const date = new Date(Number(timestamp) * 1000);
    return date.toLocaleString("zh-CN", { 
      year: 'numeric', month: 'numeric', day: 'numeric', 
      hour: '2-digit', minute: '2-digit', second: '2-digit' 
    });
  };

  const handlePay = async () => {
    try {
      const escrowAddress = "0x3C04eFaED53ab8b35eD8D58F075cdCb0D22603Db";
      await writeToken({ functionName: "approve", args: [escrowAddress, order.amount] });
      await writeEscrow({ functionName: "deposit", args: [id] });
      refetch();
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <tr className="hover:bg-base-200/50">
      <td className="font-bold">{id.toString()}</td>
      <td><Address address={order.buyer} size="sm" /></td>
      <td><Address address={order.seller} size="sm" /></td>
      <td>{formatUnits(order.amount, 18)}</td>
      <td className="text-xs text-gray-500">{formatDate(order.deadline)}</td>
      <td className="max-w-[150px] truncate" title={order.description}>{order.description}</td>
      <td>
        <span className={`badge ${statusInfo.color} badge-sm font-medium`}>{statusInfo.text}</span>
      </td>
      <td>
        <div className="flex gap-2">
          {/* 操作按钮区域 */}
          {isBuyer && Number(order.status) === 0 && (
            <button className="btn btn-xs btn-primary" onClick={handlePay}>付款</button>
          )}
          {isBuyer && Number(order.status) === 1 && (
            <button className="btn btn-xs btn-success" onClick={() => writeEscrow({ functionName: "confirm", args: [id] }).then(() => refetch())}>确认收货</button>
          )}
          {(isBuyer || isSeller) && Number(order.status) === 1 && (
            <button className="btn btn-xs btn-warning" onClick={() => writeEscrow({ functionName: "dispute", args: [id] }).then(() => refetch())}>争议</button>
          )}
          {isArbiter && Number(order.status) === 4 && (
            <>
              <button className="btn btn-xs btn-error" onClick={() => writeEscrow({ functionName: "resolve", args: [id, false] }).then(() => refetch())}>退款</button>
              <button className="btn btn-xs btn-info" onClick={() => writeEscrow({ functionName: "resolve", args: [id, true] }).then(() => refetch())}>打款</button>
            </>
          )}
          {/* 没权限或者没操作时显示无 */}
          {!( (isBuyer && [0,1].includes(Number(order.status))) || (isArbiter && Number(order.status) === 4) || ((isBuyer||isSeller) && Number(order.status) === 1) ) && (
            <span className="text-gray-400 text-xs">无</span>
          )}
        </div>
      </td>
    </tr>
  );
}