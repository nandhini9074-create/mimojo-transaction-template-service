import { IsNumber, IsNotEmpty } from "class-validator";

export class GetPaydayTransactionDto {
    @IsNumber()
    @IsNotEmpty()
    pageIndex: number;

    @IsNumber()
    @IsNotEmpty()
    pageSize: number;
}